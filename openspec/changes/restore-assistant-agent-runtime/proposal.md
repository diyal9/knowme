## Why

React 迁移后助理只发了 `prompt + sessionId + history`，没有带上重构前的 Agent Runtime 契约（`runId`、`agentId`、contentGrounding、skillRefs、v2 事件归约）。停止生成无效，正文不走 Markdown，流式 chunk 还会覆盖 v2 `answer.committed`。用户要求对话逻辑、界面、交互与 Runtime 全部回到 `f6ad048`。

## What Changes

- 发送路径对齐：预先分配 `runId` 并立刻可取消；带 `agentId`、grounding、附件上下文、`/skill` refs。
- 流式只对 v2 envelope 走 `AgentMessageState.reduceMessageEvent`；v2 消息忽略 raw chunk 正文。
- 助手气泡用 `markdown-lite` 渲染 `.agent-md`；时间线仍在消息内。
- 工作台对话复用同一套 generate/runtime，不挂助理 Ctrl+K，不渲染 Daemon 过程卡。

## Capabilities

### Modified Capabilities

- `agent-chat-ux`
- `agent-run`（渲染层接入既有 executor，不改主进程协议）
