# Proposal: agent-stream-repaint-diff

## Why

用户反馈：Agent 输出过程中界面仍然「闪屏」。2026-07-22 的 `stream-flicker-fix` 只解决了「未闭合表格/围栏每 chunk 重解析」，没有解决 **DOM 重建策略**本身。当前实现里有三处高频整块重建：

1. `refreshAssistantProgress()` 每个工具事件 **以及 `syncThinkingTicker` 每秒一次**，都用 `timeline.replaceWith(next)` 把整棵「执行过程」`<details>` 换掉。新节点上的 `agent-orb-breathe` / `agent-trace-pulse` 动画每次从头重播，`agent-trace-row` 的 transition 也重放 —— 肉眼就是 1Hz 频闪。用户展开的工具详情、以及自己折叠的「执行过程」，也会被强制复位。
2. `paintStreamText()` 每帧把整个 `.chat-text` `replaceWith` 掉。哪怕只是尾部多了一个字，前面所有已渲染的段落 / 表格 / 链接卡片都会销毁重建，触发整块重排。
3. 首个 token 到达时（思考态 → 正文）走 `renderChat()` 全量 `innerHTML`，整个会话 DOM 被推倒重来，视觉上是一次大闪。

## Target Users

- 使用工作台 Agent 长回答（写作 / 办公文档 / 编程）的用户
- 会在流式过程中展开「执行过程」查看工具详情的用户

## What

- 引入**签名化增量 patch**：为 trace 行 / round 分隔 / 计划项打 `data-sig`，只替换签名变化的节点
- 「执行过程」改为原地 patch：标题 / 计时 / 状态图标各自按需更新，节点身份保持不变
- patch 期间**不再强制 `open`**，尊重用户手动折叠与展开的工具详情
- 流式正文改为**子节点级 diff**：仅新增/变化的块被替换；`.md-stream-tail` 直接改 `textContent`，常见「同一行继续打字」场景零节点churn
- 首个 token 到达时**就地把思考气泡升级为正文气泡**，不再整页 `renderChat()`

## Non-goals

- 不改 Markdown 解析器本身与 `splitStreamingMarkdown` 稳定切分策略
- 不改主进程 SSE / IPC 协议
- 不改建议卡片（suggestion bar）在流结束后才渲染的既有设计
- 不引入虚拟 DOM 库或框架

## Success

- 流式输出中「执行过程」呼吸球动画连续不重启，计时每秒平滑跳字而非整卡重绘
- 已渲染段落在后续帧中 DOM 节点身份不变（无整块重排）
- 用户展开的工具详情在流式中保持展开
- 首个 token 出现时不再整页重绘
- `npm test` / `npm run lint` 全绿
