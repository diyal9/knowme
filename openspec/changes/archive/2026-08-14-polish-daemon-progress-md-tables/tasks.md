## 1. Markdown table parsing

- [x] 1.1 `markdown-lite.js` 识别表头+分隔行+数据行，输出 `md-table-wrap` / `md-table`
- [x] 1.2 单元格走既有 `inline` 渲染（code/bold），内容先转义

## 2. Progress pane polish

- [x] 2.1 `.wb-daemon-progress-md` 增加表格样式（头底、边框、横滑）
- [x] 2.2 轻量优化元信息列表为键值卡片行

## 3. Tests and gate

- [x] 3.1 `tests/markdown-lite.test.js` 覆盖 Steps 样例表
- [x] 3.2 `npm test` / `npm run lint`
