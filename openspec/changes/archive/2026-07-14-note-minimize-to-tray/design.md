# Design: note-minimize-to-tray

## 主进程

- 复用 `lastClosedNoteId`（与 note-close-resume 共用，不落盘）
- 新增 `minimizeNoteToTray(noteId)`：
  1. 若便签仍存在 → 写入 `lastClosedNoteId` + `updateTray()`
  2. `hideAllWindows()`（不调用 `resumeAfterNoteHide`，避免弹总览）
  3. `updateTaskbarAnchor()` 保持任务栏锚点可点
- 调整 `restoreAppWindows()` 优先级：
  1. 已有可见便签 / 总览 / 设置 → 仅聚焦
  2. 否则若 `lastClosedNoteId` 有效 → `showNote`
  3. 否则沿用多便签开总览 / 单便签 / 新建

## 渲染 / IPC

- `note.html`：顶栏按钮图标 `trash` → `minimize`；文案改为最小化到托盘
- `preload`：`minimizeToTray(id)` → `note-minimize-tray`
- 全文 / 分段模式共用同一顶栏，无需双份 UI
- 右键「删除便签…」仍走 `cmd-delete` / `note-delete`

## 性能

- 无额外磁盘 IO；仅 hide + 一次 show/focus
