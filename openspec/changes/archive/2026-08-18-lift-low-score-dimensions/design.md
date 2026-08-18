# 三低维优化路径 — lift-low-score-dimensions

## 当前相对低分（冲 90 后）

| 维度 | 分/15 | 本轮落地 | 下一档（大幅提升） |
|------|-------|----------|-------------------|
| 体验保真 / Parity | 15 | 过程状态条 + 流式去 Markdown 闪 | Electron 像素 diff；workflow To-dos；S-files inline diff |
| 产品能力广度 | 14 | provider 预载进 chrome | 真实 token IPC；管线 gate 全接线；Package 向导 |
| 运行时性能体感 | 15 | 流式纯文本 + Virtuoso(>40) + Worker | IPC 分批；性能指标门禁 |

## 本轮代码

- `AgentMessageBubble`：流式 `agent-md-fallback`，结束 lazy `ContentView`
- `AssistantStreamStatus`：composer 上过程条（`assistantStatus` / `processFeed`）
- `store-session`：stage summary → `assistantProcessFeed`
- `loadAssistantChrome`：并行 `knowledgeProviderList`
