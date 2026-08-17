## Context

基线 `f6ad048` `workspace-agent.js` send + `applyV2StreamEvent`。主进程 `ai-generate` / `agent-run-executor` 仍在。缺口在渲染接入。

## Decisions

1. 复用 `src/lib/agent-message-state`、`conversation-grounding`、`markdown-lite`，domain 做薄封装，禁止再写第二套 reducer。
2. v2 事件 `version == null` 的 legacy stage 仍可 upsert 到 `trace`（ipc 扁平事件），但不让 chunk 覆盖已 committed 的正文。
3. `generateRunId` 在 `aiGenerate` 返回前写入，停止按钮才有效。

## Risks

- CJS IIFE 模块在 Vite 下的 default 解包；用 unwrap helper。
