# 制作人体验验收: note-minimize-to-tray

## 核心路径

- [x] 顶栏垃圾桶改为最小化图标（全文/分段共用顶栏）  
  （契约：`btnMin` + `data-icon="minimize"` + `minimizeToTray`）
- [x] 点最小化 → 全窗隐藏到托盘，不删文件、不弹总览  
  （`minimizeNoteToTray` → `lastClosedNoteId` + `hideAllWindows`，不调 `resumeAfterNoteHide`）
- [x] 任务栏/托盘恢复 → 优先打开刚才那张编辑窗  
  （`restoreAppWindows` 优先 `showNote(lastClosedNoteId)`）
- [x] 永久删除仍在右键/总览；设置文案已改  

## 体验标准

- 无多余确认弹窗（最小化即生效）✅
- 不因最小化误弹总览抢焦点 ✅
- 图标语义为「收起」而非「删除」✅
- 与现有轻量顶栏风格一致 ✅

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-07-14
- 备注：ADVISORY — 完整 GUI 任务栏点击依赖本机实机；逻辑与单测已覆盖。请用户确认一次任务栏恢复路径。
