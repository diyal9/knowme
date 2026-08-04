# Tasks: agent-stream-repaint-diff

- [x] 1. 新建 `agent-stream-repaint-diff` change 工件与 `agent-thinking-timeline` / `agent-chat-ux` specs 增量
- [x] 2. 新增 `quickHash` / `withSig` / `elementSignature` / `reconcileKeyedChildren` 增量工具
- [x] 3. trace 行 / round 分隔 / 计划项在 HTML 生成阶段带上 `data-sig`
- [x] 4. `refreshAssistantProgress` 改走 `patchExecutionTimeline` 原地更新，保留动画 / 展开态 / 折叠态
- [x] 5. `paintStreamText` 改为 `reconcileStreamChildren` 子节点 diff，`.md-stream-tail` 原地改 `textContent`
- [x] 6. 首个 token 到达时 `upgradeThinkingBubble` 就地升级，去掉整页 `renderChat()`
- [x] 7. 补 `tests/agent-stream-repaint.test.js`；执行 `npm test`、`npm run lint`，补写开发自测证据与 code-review
