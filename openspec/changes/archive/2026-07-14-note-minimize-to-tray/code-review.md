# Code review: note-minimize-to-tray

## 范围

`src/main.js`、`src/preload.js`、`src/note.html`、`src/settings.html`、`tests/note-minimize-to-tray.test.js`

## 结论

- PASS：最小化与 ✕ 关闭路径隔离（`minimizeNoteToTray` 不调用 `resumeAfterNoteHide`）
- PASS：`restoreAppWindows` 仅在设置窗**可见**时抢焦点，避免隐藏设置劫持托盘恢复
- PASS：删除能力保留在右键/`note-delete`，顶栏不再误触删
- ADVISORY：任务栏钩子仍依赖 Windows `hookWindowMessage(278)`，与既有托盘恢复一致，实机再确认一次

## 审查人

开发自审 · 2026-07-14
