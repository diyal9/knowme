## ADDED Requirements

### Requirement: Long markdown does not block first paint

终态长 Markdown（≥ Worker 阈值）MUST NOT 在首次 paint 的调用栈上执行 `parseContentBlocks`。MUST 先以纯文本占位，再在 Worker 或下一宏任务完成解析后替换。

#### Scenario: Long committed source skips sync parse on first paint

- **WHEN** `ContentView` 以超过阈值的非流式 `source` 首次渲染
- **THEN** 首次 paint 不调用 `parseContentBlocks`
- **AND** 显示 pending 纯文本占位

#### Scenario: Short committed source still parses once

- **WHEN** `source` 短于阈值且非流式
- **THEN** 仍同步解析一次并立刻渲染 Markdown
