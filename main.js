/**
 * Markdown Export — plugin for typora-community-plugin
 *
 * Export the current markdown file together with its local attachments
 * to any folder on disk:
 *
 *     <exportDir>/xxx.md
 *     <exportDir>/<attachmentFolderName>/a.png
 *     <exportDir>/<attachmentFolderName>/b.png
 *
 * References are collected from three syntaxes (each toggleable in settings):
 *   - ![alt](uri)      Markdown image
 *   - <img src="uri">  HTML image
 *   - ![[uri]]         Obsidian wikilink embed
 * Any local reference that does not exist next to the md file falls back to
 * the mounted-folder root (Obsidian "shortest path" / "/rooted" links) and
 * then to a vault-wide basename lookup ("flat attachments" vaults).
 *
 * Safety:
 *   - network (http/https/ftp) and embedded (data:/blob:) URIs are skipped
 *   - missing local files keep their original reference and warn
 *   - attachments that fail to copy (locked / no permission) keep their
 *     original reference too — one bad file never aborts the whole export
 *   - attachments are COPIED — the source vault is never modified
 *   - existing files in the export folder are overwritten (re-export /
 *     shared-attachment friendly); same-name collisions *within one export*
 *     get a "-1"/"-2" suffix
 *
 * Entry:
 *   command palette (F1): "Export current markdown with attachments";
 *   a keyboard shortcut can be assigned in the framework's hotkey settings.
 *   (No File → Export menu entry: Typora offers no public menu extension
 *   API and DOM injection into the megamenu proved unreliable.)
 */

const core = window[Symbol.for("typora-plugin-core@v2")];
const { Plugin, PluginSettings, SettingTab, I18n, Notice, fs, path } = core;

/* --------------------------------------------------------------------------
 * i18n (embedded; I18n auto-picks locale from Typora settings, falls back to en)
 * ------------------------------------------------------------------------ */
const LOCALES = {
  en: {
    pluginName: "Markdown Export",
    cmdExport: "Export current markdown with attachments",
    noActiveFile: "No markdown file is open",
    readFailed: "Cannot read current file",
    chooseDir: "Choose export folder",
    exporting: "Exporting…",
    exported: "Exported to {dir} — {n} attachment(s) copied",
    missingWarn: "{n} attachment(s) missing on disk; original references kept (details in console)",
    copyFailedWarn: "{n} attachment(s) failed to copy; original references kept (details in console)",
    errExport: "Export failed",
    invalidFolderName: "Attachment folder name is invalid (empty or contains / \\ :)",
    jsBridgeUnavailable: "Folder picker requires Typora's JSBridge (unavailable here)",
    defaultDirMissing: "Default export folder does not exist — picking a folder instead",
    exportCancelled: "Export cancelled",
    settings: {
      attachmentFolderName: {
        name: "Attachment folder name",
        desc: "Sub-folder inside the export directory that collects the attachments, e.g. images / vx_images / assets. Cannot be empty or contain / \\ :",
      },
      defaultExportDir: {
        name: "Default export folder",
        desc: "Export here without asking. Leave empty to pick a folder each time (the last choice is remembered).",
      },
      resourceExts: {
        name: "Attachment extensions",
        desc: "Space/comma separated, with or without leading dot. Files with these extensions are treated as attachments and copied (add mp3/mp4/pdf if needed).",
      },
      ignoreFolders: {
        name: "Ignored folder names",
        desc: "Skipped while searching the mounted folder for unresolved references (by folder name, not path).",
      },
      findMarkdownImages: { name: "Markdown image syntax", desc: "Collect `![alt](uri)`" },
      findHtmlImages: { name: "HTML image syntax", desc: "Collect `<img src=\"uri\">`" },
      findWikiLinkImages: { name: "Wikilink embeds", desc: "Collect `![[uri]]` (Obsidian syntax)" },
      wikiLinkToMarkdown: {
        name: "Convert wikilinks to Markdown",
        desc: "Rewrite `![[img.png]]` as the standard `![img](folder/img.png)` in the exported file (best for sharing/blogs). Turn off to keep `![[folder/img.png]]`.",
      },
    },
  },
  "zh-cn": {
    pluginName: "Markdown 导出",
    cmdExport: "导出当前 Markdown（收集附件）",
    noActiveFile: "当前没有打开的 Markdown 文件",
    readFailed: "读取当前文件失败",
    chooseDir: "选择导出目录",
    exporting: "导出中…",
    exported: "已导出到 {dir}（附件 {n} 个）",
    missingWarn: "有 {n} 个附件在本地缺失，已保留原引用（详情见控制台）",
    copyFailedWarn: "有 {n} 个附件复制失败，已保留原引用（详情见控制台）",
    errExport: "导出失败",
    invalidFolderName: "附件文件夹名无效（为空或包含 / \\ :）",
    jsBridgeUnavailable: "选择目录需要 Typora 的 JSBridge（当前环境不可用）",
    defaultDirMissing: "设置的默认导出目录不存在，改为手动选择",
    exportCancelled: "已取消导出",
    settings: {
      attachmentFolderName: {
        name: "附件文件夹名",
        desc: "导出目录下收纳附件的子文件夹名，如 images / vx_images / assets。不能为空，不能包含 / \\ :",
      },
      defaultExportDir: {
        name: "默认导出目录",
        desc: "填写后导出不再询问。留空则每次弹窗选择（并记住上次选择）。",
      },
      resourceExts: {
        name: "附件扩展名",
        desc: "空格或逗号分隔，是否带点均可。这些扩展名的文件视为附件并复制（可自行加入 mp3、mp4、pdf 等）。",
      },
      ignoreFolders: {
        name: "忽略的目录名",
        desc: "搜索挂载文件夹解析引用时跳过这些目录（按目录名匹配，不是路径）。",
      },
      findMarkdownImages: { name: "Markdown 图片语法", desc: "收集 `![alt](uri)`" },
      findHtmlImages: { name: "HTML 图片语法", desc: "收集 `<img src=\"uri\">`" },
      findWikiLinkImages: { name: "Wikilink 嵌入语法", desc: "收集 `![[uri]]`（Obsidian 语法）" },
      wikiLinkToMarkdown: {
        name: "wikilink 转标准语法",
        desc: "导出文件中将 `![[img.png]]` 重写为标准的 `![img](文件夹/img.png)`（适合分享/发布博客）。关闭则保留 `![[文件夹/img.png]]` 形式。",
      },
    },
  },
};
// alias so locale "zh" (some Typora builds report "zh", not "zh-cn") also matches
LOCALES["zh"] = LOCALES["zh-cn"];

/* defaults */
const DEFAULT_SETTINGS = {
  attachmentFolderName: "images",
  defaultExportDir: "",
  resourceExts: ".jpg .jpeg .png .gif .svg .tiff .ico .webp .bmp .jfif .avif",
  ignoreFolders: ".git .idea .typora node_modules",
  findMarkdownImages: true,
  findHtmlImages: true,
  findWikiLinkImages: true,
  wikiLinkToMarkdown: true,
};

/* safety net for the vault-wide basename lookup */
const MAX_DEPTH = 40; // hard limit against symlink loops

/* --------------------------------------------------------------------------
 * small utils
 * ------------------------------------------------------------------------ */
const msg = (e) => (e && e.message ? e.message : String(e));

/** unified comparison key: forward slashes + lower case
 *  (Windows FS is case-insensitive; references often mistype the case) */
const normKey = (p) => p.replace(/\\/g, "/").toLowerCase();

/** node path.resolve(base, rel) replacement built on core `path` */
const resolvePath = (baseDir, p) => (path.isAbsolute(p) ? p : path.join(baseDir, p));

const jsBridge = () => (typeof JSBridge !== "undefined" ? JSBridge : null);

/** URL-encode a markdown reference. Keeps `/` and non-ASCII (CJK) readable —
 *  Typora/Obsidian style — and escapes only the characters that break
 *  markdown destinations. Parens included: CommonMark only accepts them
 *  when balanced, so names like "图(未完成.png" would break the link. */
const encodeRef = (p) =>
  p.replace(
    /[\\\s<>"#%?{}|^`()[\]]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")
  );

/** Replace the uri *inside* a matched reference: after "](" for markdown
 *  syntax, inside the src="…" attribute for HTML — never the first
 *  occurrence, which can be the alt text (e.g. ![see a.png](a.png)).
 *  Plain slicing also avoids String.replace "$&"-style pitfalls. */
const replaceUriInMatch = (match, rawUri, newUri) => {
  let i = -1;
  const srcAttr = /(?:^|[\s"'])src\s*=\s*(["'])([^"']*)\1/i.exec(match);
  if (srcAttr && srcAttr[2] === rawUri) {
    i = srcAttr.index + srcAttr[0].lastIndexOf(srcAttr[2]);
  } else {
    const paren = match.indexOf("](");
    if (paren >= 0) i = match.indexOf(rawUri, paren + 2);
    if (i < 0) i = match.indexOf(rawUri);
  }
  if (i < 0) return match;
  return match.slice(0, i) + newUri + match.slice(i + rawUri.length);
};

/* --------------------------------------------------------------------------
 * reference extraction — MD/HTML regexes ported verbatim from
 * resource-manager (they originate from Typora's own File.editor.brush
 * rules, see upstream obgnail/typora_plugin comment)
 * ------------------------------------------------------------------------ */
// eslint-disable-next-line no-control-regex
const MD_IMG_REGEX = /(\!\[((?:\[[^\]]*\]|[^\[\]])*)\]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])((?:.|\n)*?)\6[ \t]*)?)(\)(?:\s*{([^{}\(\)]*)})?)/g;
const HTML_IMG_REGEX = /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/gi;

/** Obsidian wikilink embed: `![[path]]`, `![[path|size]]`, `![[path#anchor]]`
 *  — path captured in group 1; `#anchor` and `|size/alias` are stripped */
const WIKI_EMBED_REGEX = /!\[\[([^\]|\[#]+)(?:#[^\]]*)?(?:\|[^\]]*)?\]\]/g;

const isNetworkUri = (uri) => /^(https?|ftp):\/\//.test(uri);
const isSpecialUri = (uri) => /^(blob|chrome-blob|moz-blob|data):[^/]/.test(uri);

/** strip <>, url-decode, drop ?query, drop leading / or \ (same as upstream).
 *  A literal "%" in a file name makes decodeURIComponent throw — keep the
 *  raw string then; the reference must not be dropped. */
function normalizeImageUri(uri) {
  uri = uri.replace(/^\s*<\s*/, "").replace(/\s*>\s*$/, "");
  try {
    uri = decodeURIComponent(uri);
  } catch (e) {
    /* name contains a raw % — keep it as-is */
  }
  return uri.split("?")[0].replace(/^\s*([\\/])/, "");
}

/* --------------------------------------------------------------------------
 * walker (serial BFS, no symlink chase; ported from resource-manager)
 * ------------------------------------------------------------------------ */
async function walkDir(root, { ignoreFolders, onFile }) {
  const ignore = new Set(ignoreFolders);
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    if (depth > MAX_DEPTH) continue;
    let names;
    try {
      names = await fs.list(dir);
    } catch (e) {
      console.warn("[markdown-export] cannot list dir:", dir, e);
      continue;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      let isDir;
      try {
        isDir = await fs.isDirectory(full);
      } catch (e) {
        continue;
      }
      if (isDir) {
        if (!ignore.has(name)) queue.push({ dir: full, depth: depth + 1 });
      } else {
        await onFile(full, name);
      }
    }
  }
}

/* --------------------------------------------------------------------------
 * exporter
 * ------------------------------------------------------------------------ */
class MarkdownExporter {
  /** @param plugin the plugin instance (settings / i18n / app access) */
  constructor(plugin) {
    this.plugin = plugin;
    this._vaultIndex = null; // basename(lower) -> absolute path, built lazily per session
  }

  /* ---- settings helpers ------------------------------------------------ */

  _extSet() {
    const raw = String(this.plugin.settings.get("resourceExts") || "");
    return new Set(
      raw.split(/[\s,]+/)
        .filter(Boolean)
        .map((e) => (e.startsWith(".") ? e.toLowerCase() : "." + e.toLowerCase()))
    );
  }

  _ignoreFolders() {
    const raw = String(this.plugin.settings.get("ignoreFolders") || "");
    return raw.split(/[\s,]+/).filter(Boolean);
  }

  /* ---- reference collection -------------------------------------------- */

  /**
   * Collect local attachment references from the markdown text.
   * @returns {refs: [{rawUri, normalized, resolved, source, start, end, match}],
   *           remoteCount: number}
   */
  async collect(text, mdDir, resourceExts) {
    const s = this.plugin.settings;
    const flags = {
      markdown: !!s.get("findMarkdownImages"),
      html: !!s.get("findHtmlImages"),
      wiki: !!s.get("findWikiLinkImages"),
    };

    const refs = [];
    let remoteCount = 0;
    const push = (rawUri, source, index, match) => {
      const u = normalizeImageUri(rawUri);
      if (!u) return;
      if (isNetworkUri(u) || isSpecialUri(u)) {
        remoteCount++;
        return;
      }
      if (!resourceExts.has(path.extname(u).toLowerCase())) return;
      refs.push({
        rawUri,
        normalized: u,
        resolved: null,
        source,
        start: index,
        end: index + match.length,
        match,
      });
    };

    if (flags.markdown) for (const m of text.matchAll(MD_IMG_REGEX)) push(m[4], "md", m.index, m[0]);
    if (flags.html) for (const m of text.matchAll(HTML_IMG_REGEX)) push(m[2], "html", m.index, m[0]);
    if (flags.wiki) for (const m of text.matchAll(WIKI_EMBED_REGEX)) push(m[1].trim(), "wiki", m.index, m[0]);

    for (const ref of refs) {
      ref.resolved = await this._resolveAny(ref.normalized, mdDir, resourceExts);
    }
    return { refs, remoteCount };
  }

  /**
   * Reference resolution (every source):
   *   1. resolve against the md folder (relative links, ![[dir/img.png]],
   *      bare names when they sit next to the note)
   *   2. resolve against the mounted-folder root — Obsidian "shortest path"
   *      and "absolute path in vault" links, rooted "/vx_images/…" references
   *   3. basename lookup across the mounted folder (matches Obsidian "flat
   *      attachments" vaults and bare wikilinks; first hit wins)
   * Returns a path either way — non-existent results are reported as
   * missing during the copy phase, keeping the original reference.
   */
  async _resolveAny(u, mdDir, resourceExts) {
    const direct = resolvePath(mdDir, u);
    try {
      if (await fs.exists(direct)) return direct;
    } catch (e) { /* fall through */ }
    const vaultPath = this.plugin.app && this.plugin.app.vault ? this.plugin.app.vault.path : "";
    if (vaultPath) {
      const fromRoot = resolvePath(vaultPath, u);
      if (fromRoot !== direct) {
        try {
          if (await fs.exists(fromRoot)) return fromRoot;
        } catch (e) { /* fall through */ }
      }
    }
    const index = await this._getVaultIndex(resourceExts);
    const hit = index.get(path.basename(u).toLowerCase());
    if (hit) return hit;
    return direct;
  }

  /** lazily build a basename index of the mounted folder (per session) */
  async _getVaultIndex(resourceExts) {
    if (this._vaultIndex) return this._vaultIndex;
    const index = new Map();
    const vaultPath = this.plugin.app && this.plugin.app.vault ? this.plugin.app.vault.path : "";
    if (vaultPath) {
      await walkDir(vaultPath, {
        ignoreFolders: this._ignoreFolders(),
        onFile: (full, name) => {
          const ext = path.extname(name).toLowerCase();
          if (resourceExts.has(ext) && !index.has(name.toLowerCase())) {
            index.set(name.toLowerCase(), full);
          }
        },
      });
    }
    this._vaultIndex = index;
    return index;
  }

  /* ---- export ------------------------------------------------------------ */

  /**
   * @param refs    result of collect()
   * @returns {mdDest, copied, renamed, missing: string[], failed: string[]}
   */
  async exportTo(text, refs, exportDir, activeFile) {
    const t = this.plugin.i18n.t;
    const folderName = String(this.plugin.settings.get("attachmentFolderName") || "").trim();
    if (!folderName || /[\\/:]/.test(folderName)) {
      throw new Error(t.invalidFolderName);
    }
    const attachmentsDir = path.join(exportDir, folderName);
    try {
      await fs.mkdir(attachmentsDir); // failure = already exists → copy will tell
    } catch (e) { /* ignore */ }

    const usedNames = new Map();    // destName key -> resolved key
    const destByResolved = new Map(); // resolved key -> dest basename
    const toMarkdown = !!this.plugin.settings.get("wikiLinkToMarkdown");

    const allocateName = (resolved) => {
      const rKey = normKey(resolved);
      if (destByResolved.has(rKey)) return destByResolved.get(rKey);
      const base = path.basename(resolved);
      let candidate = base;
      let i = 1;
      // different source, same name → "-1"/"-2" suffix; same source → reuse
      while (usedNames.has(normKey(candidate)) && usedNames.get(normKey(candidate)) !== rKey) {
        const ext = path.extname(base);
        candidate = base.slice(0, base.length - ext.length) + "-" + i + ext;
        i++;
      }
      usedNames.set(normKey(candidate), rKey);
      destByResolved.set(rKey, candidate);
      return candidate;
    };

    const edits = []; // {start, end, replacement}
    const missing = [];
    const failed = []; // exists on disk but could not be copied
    let copied = 0;
    let renamed = 0;

    for (const ref of refs) {
      let exists = false;
      try { exists = await fs.exists(ref.resolved); } catch (e) { /* missing */ }
      if (!exists) {
        missing.push(ref.rawUri);
        continue;
      }
      const destName = allocateName(ref.resolved);
      const destPath = path.join(attachmentsDir, destName);
      if (normKey(ref.resolved) === normKey(destPath)) {
        // exporting into the folder that already holds this attachment:
        // nothing to copy (fs.cp(x, x) is an error) — the rewrite below
        // is all it takes
        copied++;
      } else {
        try {
          await fs.copy(ref.resolved, destPath);
          copied++;
        } catch (e) {
          // one bad file must not abort the export: keep the original
          // reference for it and report at the end
          failed.push(ref.rawUri);
          console.warn("[markdown-export] copy failed:", ref.resolved, e);
          continue;
        }
      }
      if (destName !== path.basename(ref.resolved)) renamed++;

      if (ref.source === "wiki") {
        if (toMarkdown) {
          const alt = path.basename(destName, path.extname(destName));
          edits.push({
            start: ref.start,
            end: ref.end,
            replacement: "![" + alt + "](" + encodeRef(folderName + "/" + destName) + ")",
          });
        } else {
          // keep wikilink form; wikilink paths stay unencoded (Obsidian semantics)
          edits.push({
            start: ref.start,
            end: ref.end,
            replacement: "![[" + folderName + "/" + destName + "]]",
          });
        }
      } else {
        // replace just the uri substring inside the original match,
        // located after "](" (or inside src="…") — never the first
        // occurrence, which can be the alt text
        edits.push({
          start: ref.start,
          end: ref.end,
          replacement: replaceUriInMatch(ref.match, ref.rawUri, encodeRef(folderName + "/" + destName)),
        });
      }
    }

    // apply edits back-to-front; skip overlaps (malformed mixes like ![[x]](y))
    edits.sort((a, b) => b.start - a.start);
    let out = text;
    let lastStart = text.length;
    for (const e of edits) {
      if (e.end > lastStart) continue;
      out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
      lastStart = e.start;
    }

    const mdDest = path.join(exportDir, path.basename(activeFile));
    await fs.writeText(mdDest, out);
    return { mdDest, copied, renamed, missing, failed };
  }

  /* ---- entry point ------------------------------------------------------- */

  async exportCurrent() {
    const t = this.plugin.i18n.t;
    const app = this.plugin.app;
    const activeFile = app.workspace && app.workspace.activeFile;
    if (!activeFile) {
      Notice.warning(t.noActiveFile);
      return;
    }

    let text;
    try {
      text = await fs.readText(activeFile);
    } catch (e) {
      console.error("[markdown-export] read failed:", e);
      Notice.error(t.readFailed + ": " + msg(e));
      return;
    }

    let refs, remoteCount;
    try {
      ({ refs, remoteCount } = await this.collect(text, path.dirname(activeFile), this._extSet()));
    } catch (e) {
      console.error("[markdown-export] collect failed:", e);
      Notice.error(t.errExport + ": " + msg(e));
      return;
    }
    if (remoteCount > 0) {
      console.info("[markdown-export] skipped remote/embedded images:", remoteCount);
    }

    const exportDir = await this._resolveExportDir();
    if (!exportDir) {
      Notice.info(t.exportCancelled, 2000);
      return;
    }

    const notice = Notice.info(t.exporting, 0);
    try {
      const result = await this.exportTo(text, refs, exportDir, activeFile);
      notice.close();
      console.info("[markdown-export] done:", result);
      Notice.success(
        t.exported.replace("{dir}", result.mdDest).replace("{n}", result.copied),
        6000
      );
      if (result.missing.length > 0) {
        console.warn("[markdown-export] missing attachments (references kept):", result.missing);
        Notice.warning(t.missingWarn.replace("{n}", result.missing.length), 6000);
      }
      if (result.failed && result.failed.length > 0) {
        console.warn("[markdown-export] copy failed (references kept):", result.failed);
        Notice.warning(t.copyFailedWarn.replace("{n}", result.failed.length), 6000);
      }
    } catch (e) {
      notice.close();
      console.error("[markdown-export] export failed:", e);
      Notice.error(t.errExport + ": " + msg(e));
    }
  }

  /** settings default dir if usable, else a folder picker (remembers choice) */
  async _resolveExportDir() {
    const t = this.plugin.i18n.t;
    const def = String(this.plugin.settings.get("defaultExportDir") || "").trim();
    if (def) {
      try {
        if (await fs.exists(def)) return def;
      } catch (e) { /* fall through to picker */ }
      Notice.warning(t.defaultDirMissing);
    }

    const bridge = jsBridge();
    if (!bridge) {
      Notice.error(t.jsBridgeUnavailable);
      return null;
    }
    const last = String(this.plugin.settings.get("lastExportDir") || "").trim();
    let picked = null;
    try {
      picked = await bridge.invoke("dialog.showOpenDialog", {
        title: t.chooseDir,
        properties: ["openDirectory", "createDirectory"],
        defaultPath: last || (this.plugin.app.vault ? this.plugin.app.vault.path : undefined),
      });
    } catch (e) {
      console.warn("[markdown-export] folder picker failed:", e);
      Notice.error(t.jsBridgeUnavailable);
      return null;
    }
    if (!picked || picked.canceled || !picked.filePaths || !picked.filePaths.length) return null;
    const dir = picked.filePaths[0];
    try {
      this.plugin.settings.set("lastExportDir", dir); // runtime memory, not shown in settings
    } catch (e) { /* non-fatal */ }
    return dir;
  }
}

/* --------------------------------------------------------------------------
 * settings tab
 * ------------------------------------------------------------------------ */
class MarkdownExportSettingTab extends SettingTab {
  constructor(plugin) {
    super();
    this.plugin = plugin;
  }

  get name() {
    return this.plugin.i18n.t.pluginName;
  }

  show() {
    const { plugin } = this;
    const t = plugin.i18n.t.settings;
    this.addSettingTitle(plugin.i18n.t.pluginName);

    this.addSetting((setting) => {
      setting.addName(t.attachmentFolderName.name);
      setting.addDescription(t.attachmentFolderName.desc);
      setting.addText((input) => {
        input.value = plugin.settings.get("attachmentFolderName") || "";
        input.onchange = () => plugin.settings.set("attachmentFolderName", input.value.trim());
      });
    });
    this.addSetting((setting) => {
      setting.addName(t.defaultExportDir.name);
      setting.addDescription(t.defaultExportDir.desc);
      setting.addText((input) => {
        input.value = plugin.settings.get("defaultExportDir") || "";
        input.onchange = () => plugin.settings.set("defaultExportDir", input.value.trim());
      });
    });
    this.addSetting((setting) => {
      setting.addName(t.resourceExts.name);
      setting.addDescription(t.resourceExts.desc);
      setting.addTextArea((input) => {
        input.value = plugin.settings.get("resourceExts") || "";
        input.onchange = () => plugin.settings.set("resourceExts", input.value.trim());
      });
    });
    this.addSetting((setting) => {
      setting.addName(t.ignoreFolders.name);
      setting.addDescription(t.ignoreFolders.desc);
      setting.addTextArea((input) => {
        input.value = plugin.settings.get("ignoreFolders") || "";
        input.onchange = () => plugin.settings.set("ignoreFolders", input.value.trim());
      });
    });
    const addToggle = (key) => {
      this.addSetting((setting) => {
        setting.addName(t[key].name);
        setting.addDescription(t[key].desc);
        setting.addCheckbox((checkbox) => {
          checkbox.checked = !!plugin.settings.get(key);
          checkbox.onclick = () => plugin.settings.set(key, checkbox.checked);
        });
      });
    };
    addToggle("findMarkdownImages");
    addToggle("findHtmlImages");
    addToggle("findWikiLinkImages");
    addToggle("wikiLinkToMarkdown");

    super.show();
  }

  hide() {
    this.containerEl.innerHTML = "";
    super.hide();
  }
}

/* --------------------------------------------------------------------------
 * plugin entry
 * ------------------------------------------------------------------------ */
class MarkdownExportPlugin extends Plugin {
  constructor(app, manifest, config) {
    super(app, manifest, config);
    this.i18n = new I18n({ resources: LOCALES });
    this.exporter = null;
  }

  onload() {
    this.registerSettings(new PluginSettings(this.app, this.manifest, { version: 1 }));
    this.settings.setDefault(DEFAULT_SETTINGS);
    this.exporter = new MarkdownExporter(this);

    this.registerCommand({
      id: "export-current-file",
      title: this.i18n.t.cmdExport,
      scope: "editor",
      callback: () => this.exporter.exportCurrent(),
    });

    this.registerSettingTab(new MarkdownExportSettingTab(this));
  }
}

export default MarkdownExportPlugin;
