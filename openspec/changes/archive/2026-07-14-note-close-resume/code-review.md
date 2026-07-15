# Code review: note-close-resume

## 范围

`src/main.js`、`src/preload.js`、`src/list.html`、`src/note.html`、`tests/note-close-resume.test.js`

## 结论

- PASS：续编路径集中在 `resumeAfterNoteHide`，与「隐藏全部」隔离
- PASS：列表高亮有超时清理，避免常驻 flash
- ADVISORY：实机需确认折叠项目组下非 latest 版本高亮是否展开组（已处理 openProjectGroup 回退）

## 审查人

开发自审 · 2026-07-14
