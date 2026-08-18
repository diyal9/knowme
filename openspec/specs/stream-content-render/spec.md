# stream-content-render Specification

## Purpose
流式 Markdown 增量解析；终态短文一次全量解析，长文不得在首次 paint 阻塞主线程。

## Requirements
### Requirement: Streaming markdown parse stays incremental

While an assistant message is streaming, KnowMe MUST avoid fully re-parsing the entire stable markdown prefix on every token when a cached prefix is still valid. UI updates during streaming MAY be throttled.

#### Scenario: Stable prefix is reused

- **WHEN** streaming source grows but the stable prefix (ending at a fence-balanced `\n\n`) is unchanged
- **THEN** only the tail after that prefix is re-parsed and concatenated with cached prefix blocks

#### Scenario: Stream end uses full parse for short source

- **WHEN** streaming becomes false and source length is below the Worker threshold
- **THEN** the view parses the full source without relying on a stale stream cache

### Requirement: Long markdown does not block first paint

终态长 Markdown（≥ Worker 阈值）MUST NOT 在首次 paint 的调用栈上执行 `parseContentBlocks`。MUST 先以纯文本占位，再在 Worker 或下一宏任务完成解析后替换。

#### Scenario: Long committed source skips sync parse on first paint

- **WHEN** `ContentView` 以超过阈值的非流式 `source` 首次渲染
- **THEN** 首次 paint 不调用 `parseContentBlocks`
- **AND** 显示 pending 纯文本占位

#### Scenario: Short committed source still parses once

- **WHEN** `source` 短于阈值且非流式
- **THEN** 仍同步解析一次并立刻渲染 Markdown

### Requirement: Long chats virtualize older messages

The assistant chat log MUST render a bounded trailing window of messages by default and reveal older messages in pages. Message bubbles SHOULD use containment suitable for skipping off-screen rendering work.

#### Scenario: Reveal earlier page

- **WHEN** more messages exist than the current window and the user chooses to show earlier ones
- **THEN** the window grows by one page size rather than necessarily revealing the entire history at once

