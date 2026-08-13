## 1. 布局

- [x] 1.1 将 `#wbShelfSummary` 移入 `.wb-shelf-filters`（chip 与「管理工作流」之间）
- [x] 1.2 调整 `.wb-shelf-summary` 同行样式；空内容不占位

## 2. 折叠行容量

- [x] 2.1 将 `shelfRowCapacity()` 改为与两列/单列网格一致（宽 2、窄 1）
- [x] 2.2 确认默认 `shelfGridExpanded === false`，折叠态只渲染一行

## 3. 自测

- [x] 3.1 更新 `tests/workbench-templates.test.js` 静态回归
- [x] 3.2 `npm test` 与 `npm run lint` 通过；写入 `evidence/dev-self-test.md`
