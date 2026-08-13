# 开发自测报告

- 日期：2026-08-09
- Change：rename-knowledge-menu-to-web
- npm test: **PASS**（1491/1491，含新增 `knowledge-web-naming.test.js` 3 项）
- npm run lint: **PASS**
- harness gate: **PASS**（硬项 test + lint 通过）
- Electron 冒烟: **PASS**（4/4，`knowledge-web-electron-smoke.json`）
- 手动冒烟: **PASS**（rail「知识网」、drawer 标题「知识网」、无本 change 新增 console error）
- 备注：并行 workbench 重构的 `pageerror: Identifier 'api' has already been declared` 本次冒烟未复现；未触碰 workbench 相关文件。
