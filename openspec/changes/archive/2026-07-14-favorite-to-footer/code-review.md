# Code review: favorite-to-footer

## 范围

`src/note.html`、`tests/favorite-to-footer.test.js`

## 结论

- PASS：仅移动 DOM，IPC/`toggleFavorite` 未改，风险低
- PASS：顶栏/底栏选择器分离清晰（`#btnStar.on` 替代旧 `.wbtn.star`）
- ADVISORY：窄窗时底栏按钮偏多，当前 meta 可压缩，若后续再加工具需评估换行

## 审查人

开发自审 · 2026-07-14
