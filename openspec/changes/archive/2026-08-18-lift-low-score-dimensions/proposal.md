## Why

冲 90 后体验保真、产品能力、运行时性能三维仍接近天花板（14–15/15），用户体感提升有限。根因是：流式仍同步 Markdown 解析、过程状态未接 UI、知识 provider 未在 chrome 预载。

## What Changes

- 流式正文改纯文本路径，结束后再 Markdown 化
- 助理列接 `assistantStatus` / `assistantProcessFeed` 紧凑过程条
- `loadAssistantChrome` 预拉 `knowledgeProviderList`
- 复评三低维优化路径

## Capabilities

### Modified Capabilities

- `agent-chat-ux`: 流式性能 + 过程可见性
- `renderer-runtime-perf`: 流式热路径
