## Why

流式回复每个 token 全文重 parse Markdown，长对话仍渲染大量气泡，远程降级下 backdrop-filter 仍贵。需增量解析、消息窗口虚拟化、降级去 blur。

## What Changes

- 流式：节流展示源 + 稳定前缀块缓存，仅重解析尾段
- 消息列表：分页窗口（一次展开一页）+ `content-visibility` + `memo` 气泡
- `data-ui-throttle` 时关闭 backdrop-filter

## Capabilities

### New Capabilities

- `stream-content-render`: 流式内容与对话列表渲染性能

### Modified Capabilities

- （无）

## Impact

- `domain/content-blocks.ts`、`ContentView`、`AgentMessageBubble`、`AssistantPane`、CSS、`WorkspaceApp`
