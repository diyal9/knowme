# Design: md-notebook-editor

## 架构

- **渲染进程** `note.html`：textarea 源码编辑 + 预览 div；无 nodeIntegration
- **依赖**：`marked` + `DOMPurify` 以 `<script src>` UMD 引入 `src/assets/vendor/`
- **迁移**：`prompt-sections.migrateNoteFields` 在主进程 `loadAllNotes` 时执行

## 编辑/预览

| 态 | UI | 数据 |
|----|-----|------|
| edit | `#editor` textarea | 读写 `content` |
| preview | `#previewPane` innerHTML | `DOMPurify.sanitize(marked.parse(content))` |

Footer `mode-seg`：`modeEdit` / `modePreview`，持久化 `note.editorMode`。

## 斜杠菜单

- 触发：空行或行首 `/`
- 定位：镜像 div 测量 caret 像素坐标
- 插入：`document.execCommand('insertText', false, snippet)` 替换 `/query`

## 快捷键与气泡

- Ctrl+B/I/K、智能回车、Tab 缩进列表 — 均经 `insertText` 保留撤销栈
- 选区气泡：bold/italic/code/strike/link，复用同一 wrap 逻辑

## 预览 CSS

复用 `--text`、`--accent`、`--mono`、`--bg-top`、`--accent-b`、`--div`。

## 迁移策略

```text
if editorMode==='structured' OR sections 有内容:
  content ← assembleContent(sections) 或 parse+assemble(content)
  sections ← null
  editorMode ← 'edit'
if editorMode==='free':
  editorMode ← 'edit'
```
