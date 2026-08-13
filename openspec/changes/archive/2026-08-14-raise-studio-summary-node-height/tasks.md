## 1. Height budget

- [x] 1.1 调整 `SIZE` / `sizeForNode`：抬高 agent 地板；`mode-text` 预算对齐约 4 行目标框；分区底 padding 计入高度
- [x] 1.2 CSS：`.wb-studio-flow-section.mode-text` line-clamp 提到 4；sections 底部留白略增

## 2. Verify

- [x] 2.1 更新 `tests/workbench-studio-canvas.test.js` 断言目标区高度下限
- [x] 2.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md`
