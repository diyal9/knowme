## Context

ContentView 对每个 source 变更 `parseContentBlocks` 全量解析；AssistantPane 虽有 50 条窗口但「更早」一次展开全部；远程 UI throttle 未关掉 blur。

## Goals / Non-Goals

- Goals：流式主线程更稳；长会话少挂载/少重绘；降级少合成成本。
- Non-Goals：不上第三方虚拟列表库；不改 Markdown 语义。

## Decisions

1. `findStableContentPrefixEnd`：在偶数个 fence 的最后 `\n\n` 处切开。
2. `parseContentBlocksStreaming(source, cache)`：前缀命中则只 parse 尾段。
3. ContentView `streaming`：~100ms 节流 source，结束立即全量。
4. 消息窗口 PAGE=32，点「更早」+PAGE；气泡 `memo` + `content-visibility:auto`。
5. `html[data-ui-throttle="1"]` 去掉 backdrop-filter。
