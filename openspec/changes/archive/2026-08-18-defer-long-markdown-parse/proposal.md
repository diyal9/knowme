## Why

`ContentView` 终态长 Markdown 在 Worker 启动前仍同步 `parseContentBlocks` 两次（流式 hook + committed `useState`），主线程阻塞，性能重构不能算完成。

## What Changes

- 终态短文只同步解析一次；长文首屏不解析，纯文本占位，Worker（或下一宏任务回退）完成后再切 Markdown
- 流式 hook 在 `streaming=false` 时不再全量解析
- 预热 Worker，避免 commit 时才 `new Worker`

## 验收标准

- 长文首次 paint 不调用 `parseContentBlocks`
- 短文仍立刻出 Markdown
- 相关 ContentView / async 测试通过

## 非目标

- 不改流式纯文本路径（`AgentMessageBubble` 仍不在 chunk 上跑 Markdown）
- 不换解析器实现
