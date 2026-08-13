## 1. Styles

- [x] 1.1 更新 `.agent-tab-scroll`：隐藏可见滚动条，保留 `overflow-x: auto`
- [x] 1.2 增加 `::-webkit-scrollbar { display:none }`（与抽屉 Tab 一致）

## 2. Wheel panning

- [x] 2.1 在 `.agent-tab-scroll` 上监听 `wheel`，将滚轮增量映射为 `scrollLeft`
- [x] 2.2 仅在溢出且会实际移动时 `preventDefault`，避免误伤对话区滚动

## 3. Verification

- [x] 3.1 补充/更新 `tests/workspace-agent.test.js` 断言隐藏滚动条样式与 wheel 处理存在
- [x] 3.2 跑 `npm test` 与 `npm run lint`，写 `evidence/dev-self-test.md`
