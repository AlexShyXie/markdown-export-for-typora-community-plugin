# Markdown Export for typora-community-plugin
English | [简体中文](README.md)
Export the **currently open Markdown** in Typora together with its **local attachments** to any folder. Usually used to extract note attachments from the central attachment folder in the ob library. The exported note is fully self-contained — send it to others, upload it to a blog / cloud drive, or use it for testing, with no dependency on the original vault. Built for the typora-community-plugin ecosystem.
Inspired by [bingryan/obsidian-markdown-export-plugin](https://github.com/bingryan/obsidian-markdown-export-plugin) (it can only export inside the Obsidian vault — this plugin has no such limitation) and compatible with Obsidian `![[wikilink]]` embeds.
## Features
- **One-click export**: the open md + every local attachment it references, copied to the chosen directory (the source vault is never touched: read-only + copy, never move or delete)
- **Attachment folder**: all attachments land in one sub-folder whose name is configurable in settings (`images` / `vx_images` / `assets`…)
- **Link rewriting**: attachment references are rewritten to the new location — the export works out of the box
- **Entry point**: command palette (`F1`) → `Export current markdown with attachments`; a hotkey can be bound in the framework settings
- **Export directory**: system folder picker each time (last choice remembered), or a fixed default directory in settings
### Result layout
With the attachment folder set to `vx_images` and export target `E:\downloads`:
```
E:\downloads
├── my-note.md            ← references rewritten to vx_images/xxx.png
└── vx_images\
    ├── logo.png
    ├── photo.jpg
    └── screenshot-1.png  ← same-name collisions get a suffix
```
### Recognition rules & safety
Three embed syntaxes are recognized (each toggleable in settings):
| Syntax | Example | Notes |
| --- | --- | --- |
| Markdown image | `![alt](uri)` | Typora native syntax |
| HTML image | `<img src="uri">` | common in web-pasted content |
| Obsidian wikilink | `![[uri]]` | `\|size` and `#anchor` are stripped |
- **Reference resolution** (identical for all three syntaxes, with fallback): first resolve against the md folder (relative paths, `![[subdir/img.png]]`); if not found, resolve against the mounted-folder root (Obsidian "shortest path" / "absolute path in vault" links such as `vx_images/a.png` or `/vx_images/a.png`); if still not found, search the mounted folder recursively for a file with the same basename (extension-filtered, ignored folders skipped, first hit wins) — built for Obsidian "flat attachments" vaults
- Remote (`http/https/ftp`) and embedded (`data:`, `blob:`) images are **not** exported; their references stay untouched
- `<>` wrapping, URL percent-encoding (e.g. `%20`) and `?query` suffixes in `uri` are decoded/stripped before resolution; a literal `%` in a file name is kept as-is
- Same-name references match **case-insensitively** (Windows FS behavior)
- Attachments missing on disk: the original reference is kept and a warning is shown (details in the console); the export continues
- Attachments that fail to copy (locked / no permission): likewise kept and warned separately — **one bad file never aborts the export**; exporting into the folder that already holds an attachment skips the self-copy and only rewrites the link
- Same-name collisions *within one export* get a `-1`/`-2` suffix; existing files in the export folder are overwritten (correct for re-exports and notes sharing one attachment folder)
- New references use forward slashes; file names containing spaces, `#`, `?`, parentheses, `%` etc. are URL-encoded (CJK stays readable)
- **Zero background components**: no listeners, no timers — files are read only when an export runs
## Install
### Prerequisite
Install and enable the Typora Community Plugin Framework: https://github.com/typora-community-plugin/typora-community-plugin
### Option 1: plugin marketplace (recommended)
Open Typora → typora-community-plugin preferences → **Marketplace**, search for `Markdown Export`, install **and enable**.
### Option 2: manual
1. Download the latest `plugin.zip` from [Releases](https://github.com/AlexShyXie/markdown-export-for-typora-community-plugin/releases) and unzip it
2. Put the unzipped files into a `markdown-export` folder and copy it to:
   - global: `C:\Users\<you>\.typora\community-plugins\plugins\markdown-export\`
   - or current vault only: `<vault>\.typora\plugins\markdown-export\`
3. Open Typora → typora-community-plugin preferences → **Installed plugins** → check `Markdown Export` to enable
> Requires typora-community-plugin ≥ 2.8.2 and Typora ≥ 1.5.0.
## Usage
- Command palette (`F1`) → `Export current markdown with attachments`
- Hotkey: typora-community-plugin preferences → **Hotkeys**, bind a key to `Markdown Export: Export current markdown with attachments` (e.g. `Ctrl+Alt+E`)
- The first run opens the folder picker (positioned at the last export directory); a default directory can be fixed in settings
- A bottom-right notice summarizes the result; missing or failed attachments trigger an extra warning
- Note: the export uses the **saved** on-disk content (Typora auto-saves by default, so this is usually invisible)
## Settings
Settings → Installed plugins → Markdown Export:
| Setting | Description | Default |
| --- | --- | --- |
| Attachment folder name | sub-folder inside the export directory; cannot be empty or contain `/ \ :` | `images` |
| Default export folder | export here without asking; empty = pick each time | empty |
| Attachment extensions | extensions treated as attachments (space/comma separated; add mp3/mp4/pdf as needed) | `jpg jpeg png gif svg bmp webp ico tiff jfif avif` |
| Ignored folder names | folders skipped by the vault-wide basename search | `.git .idea node_modules .typora` |
| Markdown / HTML / Wikilink toggles | which embed syntaxes are collected | all on |
| Convert wikilinks to Markdown | rewrite `![[img.png]]` as `![img](folder/img.png)` in the export (off keeps `![[folder/img.png]]`) | on |
## Known limitations
- Only **embed syntaxes** (`![]()` / `<img>` / `![[ ]]`) are collected; plain links like `[](file.pdf)` are not
- Embedded Markdown notes are not exported recursively (`![[note]]`, `![](other.md)`)
- Image references inside code blocks are collected too (regex over the text, no Markdown syntax-tree parsing)
- `![[img.png|300]]` size annotations are dropped by the conversion (aliases too — the alt becomes the file name)
- macOS Typora has no Node environment; in theory the core fs adapter already smooths over the difference
## Changelog
### 1.0.1
- Fix: Obsidian "shortest path / absolute path in vault" links (`vx_images/a.png`, `/vx_images/a.png`) and path-style wikilinks were resolved against the md folder only and always reported missing; all three syntaxes now fall back to the mounted-folder root and a vault-wide basename search
- Fix: a single attachment that failed to copy (locked / no permission) aborted the whole export; its reference is now kept, warned separately, and the export continues
- Fix: exporting into the folder that already holds an attachment made `fs.cp(x, x)` throw; the self-copy is skipped and only the link is rewritten
- Fix: file names with unbalanced parentheses (e.g. `图(未完成.png`) produced links that CommonMark cannot render; parentheses are now always escaped
- Fix: when the alt text contained the uri (e.g. `![see a.png](a.png)`) the replacement hit the alt instead of the destination — the uri is now located after `](` / inside `src=` precisely
- Fix: a literal `%` in a file name (e.g. `50%.png`) silently dropped the whole reference; it is now processed as-is
## Differences vs obsidian-markdown-export-plugin
| obsidian-markdown-export | this plugin | reason |
| --- | --- | --- |
| Exports only inside the Obsidian vault | any directory | no vault restriction |
| — | vault-wide basename search when resolution fails | flat-attachment vaults |
Ported/referenced: the export approach of bingryan/obsidian-markdown-export-plugin, and the reference regexes of obgnail/typora_plugin (MIT License). Only tested on Windows 10.

