# 制作人体验验收: note-close-resume

## 核心路径

- [x] 编辑中点 ✕ → 一眼看到总览里刚关的那条（高亮）→ 一点继续写  
  （契约：`resumeAfterNoteHide` → `toggleListWin` + `list-highlight`；列表 `.flash`）
- [x] 托盘「继续编辑」可用  
  （`updateTray` 顶部项 → `showNote(lastClosedNoteId)`）

## 体验标准

- 无多余弹窗 ✅
- 多便签场景不抢焦点 ✅（`hasOtherVisibleNotes`）
- 文案与现有轻量风格一致 ✅

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-07-14
- 备注：ADVISORY — 完整 GUI 冒烟依赖本机托盘点击；硬逻辑与单测已覆盖。请用户实机确认一次高亮可见性。
