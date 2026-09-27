# Markdown Export for typora-community-plugin

[English](README.en.md) | 简体中文

将 Typora **当前打开的 Markdown** 连同其引用的**本地附件**一键导出到任意文件夹，导出后的笔记可独立分发——发给他人、上传博客 / 云端、做测试，不再依赖原笔记库。适配 typora-community-plugin 生态。

灵感来自 [bingryan/obsidian-markdown-export-plugin](https://github.com/bingryan/obsidian-markdown-export-plugin)（它受 Obsidian 限制只能导出到库内，本插件无此限制），并兼容 Obsidian 的 `![[wikilink]]` 嵌入语法。

## 功能概览

- **一键导出**：当前打开的 md + 它引用的所有本地附件，复制到指定目录（源笔记库零改动：只读 + 复制，绝不移动或删除）
- **附件收纳**：所有附件统一复制进一个子文件夹，文件夹名可在设置中指定（`images` / `vx_images` / `assets`……）
- **引用重写**：文档内的附件引用自动改写指向新位置，导出后开箱即用
- **命令入口**：命令面板（`F1`）→ `导出当前 Markdown（收集附件）`，可在框架设置中为命令绑定快捷键
- **导出目录**：每次弹系统目录选择框（记住上次选择），或在设置中固定默认目录

### 导出结构示例

设置附件文件夹名为 `vx_images`，导出到 `E:\downloads`：

```
E:\downloads
├── 我的笔记.md            ← 引用已改写为 vx_images/xxx.png
└── vx_images\
    ├── logo.png
    ├── photo.jpg
    └── screenshot-1.png   ← 同名冲突自动加后缀
```

### 识别规则与安全边界

识别三种嵌入语法（均可在设置中开关）：

| 语法 | 示例 | 说明 |
| --- | --- | --- |
| Markdown 图片 | `![alt](uri)` | Typora 原生语法 |
| HTML 图片 | `<img src="uri">` | 常见于从网页粘贴的内容 |
| Obsidian wikilink | `![[uri]]` | `\|尺寸`、`#锚点` 会被剥离 |

- **引用路径解析**（三种语法统一，逐级回退）：先按 md 所在目录解析（相对路径、`![[子目录/图.png]]`）；找不到再按**挂载文件夹根**解析（Obsidian「最短路径」/「库内绝对路径」链接，如 `vx_images/a.png`、`/vx_images/a.png`）；仍找不到时在**挂载文件夹内递归搜索同名文件**（按扩展名过滤、跳过忽略目录，首个命中生效）——适配「附件全部平铺在同一文件夹」的 Obsidian 库
- 网络图（`http/https/ftp`）与内嵌图（`data:`、`blob:`）**不参与**导出，引用原样保留
- `uri` 中的 `<>` 包裹、URL 百分号编码（如 `%20`）、`?query` 后缀会被解码/剥离后解析；文件名含原始 `%` 时按原样处理
- 同名引用按**大小写不敏感**匹配（Windows 文件系统行为）
- 本地缺失的附件：保留原引用并给出警告（详见控制台），不中断导出
- 复制失败（文件被占用 / 无权限）的附件：同样保留原引用并单独警告，**单个文件失败不会中断整次导出**；导出到附件自身所在目录时自动跳过自拷贝、只改写链接
- 同次导出内不同源同名附件自动加 `-1` / `-2` 后缀；导出目录已有同名附件直接覆盖（重导出 / 多篇笔记共享同一附件的场景语义正确）
- 新引用统一正斜杠，文件名含空格 / `#` / `?` / 括号 / `%` 等字符时自动 URL 编码（中文保留可读）
- **零后台组件**：无监听、无定时器，仅在触发导出时读取文件

## 安装

### 依赖前提

安装并启用 Typora Community Plugin Framework
项目地址：https://github.com/typora-community-plugin/typora-community-plugin

### 方式一：插件市场（推荐）

打开 Typora → 进入 typora-community-plugin 的偏好设置 → **插件市场**，搜索 `Markdown Export`，安装**并启用**。

### 方式二：手动安装

1. 从 [Releases](https://github.com/AlexShyXie/markdown-export-for-typora-community-plugin/releases) 下载最新的 `plugin.zip` 并解压
2. 将解压出的文件放入 `markdown-export` 文件夹，复制到：
   - 全局：`C:\Users\<你>\.typora\community-plugins\plugins\markdown-export\`
   - 或仅当前笔记库：`<笔记库>\.typora\plugins\markdown-export\`
3. 打开 Typora → 进入 typora-community-plugin 的偏好设置 → **已安装插件** → 勾选 `Markdown Export` 启用

> 需要 typora-community-plugin ≥ 2.8.2、Typora ≥ 1.5.0。

## 使用

- 命令面板（`F1`）→ `导出当前 Markdown（收集附件）`
- 快捷键：typora-community-plugin 偏好设置 → **快捷键**，为 `Markdown Export: 导出当前 Markdown（收集附件）` 绑定按键（如 `Ctrl+Alt+E`）
- 首次使用会弹出目录选择框（默认定位到上次导出的目录）；也可在设置中固定默认导出目录
- 导出完成右下角通知汇总结果；有附件缺失或复制失败时会额外警告
- 提示：导出的是**磁盘上已保存**的内容（Typora 默认自动保存，一般无感知）

## 设置项

设置 → 已安装插件 → Markdown Export：

| 项 | 说明 | 默认值 |
| --- | --- | --- |
| 附件文件夹名 | 导出目录下收纳附件的子文件夹，不能为空或包含 `/ \ :` | `images` |
| 默认导出目录 | 填写后导出不再询问；留空每次弹窗选择 | 空 |
| 附件扩展名 | 视为附件的文件扩展名（空格/逗号分隔，可加入 mp3/mp4/pdf 等） | `jpg jpeg png gif svg bmp webp ico tiff jfif avif` |
| 忽略的目录名 | 全库搜索解析引用时跳过的目录 | `.git .idea node_modules .typora` |
| Markdown / HTML / Wikilink 语法开关 | 三种嵌入语法的识别范围 | 均开启 |
| wikilink 转标准语法 | 导出文件中 `![[img.png]]` 重写为 `![img](文件夹/img.png)`（关闭则保留 `![[文件夹/img.png]]`） | 开启 |

## 已知限制

- 仅收集**嵌入语法**（`![]()` / `<img>` / `![[ ]]`）引用的附件；普通链接 `[](file.pdf)` 不收集
- 不递归导出嵌入的其他 Markdown（`![[某笔记]]`、`![](other.md)`）
- 代码块内的图片引用也会被收集（按文本正则解析，不解析 Markdown 语法树）
- `![[img.png|300]]` 的尺寸标注转换后丢弃（别名同理，alt 采用文件名）
- macOS 的 Typora 无 Node 环境，理论上 core 的 fs 适配层已抹平差异

## 更新记录

### 1.0.1

- 修复：Obsidian「最短路径 / 库内绝对路径」链接（`vx_images/a.png`、`/vx_images/a.png`）与带路径 wikilink 此前只按 md 所在目录解析、全部误报缺失；现在三种语法统一回退到挂载文件夹根 + 全库同名搜索
- 修复：单个附件复制失败（被占用 / 无权限）会中断整次导出；现在保留原引用、单独警告、继续导出
- 修复：导出目标恰为附件自身所在目录时 `fs.cp(x, x)` 报错中断；现在跳过自拷贝、仅改写链接
- 修复：文件名含未配对括号（如 `图(未完成.png`）时改写后的链接无法渲染；括号统一转义
- 修复：alt 文本包含 uri 字符串（如 `![see a.png](a.png)`）时替换错位——alt 被改坏而链接未换；现在精确定位 `](` 之后 / `src=` 之内的 uri
- 修复：文件名含原始 `%`（如 `50%.png`）时引用被静默跳过；现在按原样继续处理

## 与 obsidian-markdown-export-plugin 的差异

| obsidian-markdown-export | 本插件 | 原因 |
| --- | --- | --- |
| 只能导出到 Obsidian 库内 | 任意目录 | 免受 vault 限制 |
| — | 引用解析失败时全库同名搜索 | 适配附件平铺的库结构 |

移植/参考来源：bingryan/obsidian-markdown-export-plugin 的导出思路、obgnail/typora_plugin 的引用识别正则（MIT License）。项目仅在 Windows 10 上测试使用。
