## 1. 卡片页脚

- [x] 1.1 在 `shelfCardHtml` 页脚左下渲染最近更新（`updatedAt` 回退 `createdAt`，复用 `wbRelTime`）
- [x] 1.2 无有效时间戳时不渲染时间节点；操作按钮包入右侧 actions 容器

## 2. 样式

- [x] 2.1 更新 `workbench-shelf.css`：footer 左右分布、`.wb-shelf-updated` muted 小字

## 3. 验证

- [x] 3.1 更新 `tests/workbench-templates.test.js` 断言更新时间结构
- [x] 3.2 跑 `npm test` / `npm run lint`，写 `evidence/dev-self-test.md`
