# Design: note-close-resume

## 主进程

- 内存变量 `lastClosedNoteId`（不落盘）
- `resumeAfterNoteHide(id)`：
  1. 写入 `lastClosedNoteId`
  2. `updateTray()`（插入「继续编辑」）
  3. 若其它便签窗口均不可见 → `toggleListWin(true)` + `list-highlight`
- 挂在 `note-hide`、便签窗 `close→hide`、便签右键「关闭窗口」；**不**挂在 `hideAllWindows`

## 渲染 / IPC

- 新事件 `list-highlight`（id）
- 列表：`scrollIntoView` + 短暂 `.flash`；展开折叠组若条目被折叠则切到「全部」再高亮（尽量简单：高亮时若找不到行则 `themeKey='all'` 并重渲）

## 性能

- 无额外磁盘 IO；仅一次 list show + IPC
