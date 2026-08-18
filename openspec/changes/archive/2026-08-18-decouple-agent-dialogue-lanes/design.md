## Context

`ensureAgentSession` 在找不到 session 时会把它塞进 `openSessionIds` 并抢走 `activeSessionId`。因此工作台只好复用助理 tab。`createSession` 已支持 `ephemeral` / `taskRef` / `expertId`；助理 tab 过滤已有 `isWorkbenchOwnedSession`。

## Decisions

1. 稳定 lane id：`wb-expert-<id>`、`wb-run-<slug>`。创建时保留该 id，标记 ephemeral + taskRef，**不**写入助理 open tabs。
2. payload 带 `role`（general|steward|writing|coding）与 `expertId`。内核 `ctxRole` 优先 payload.role。
3. 过程 log 与对话消息分槽：不再把 `run.log` 映射成 ChatMessage。
4. 共享 `invokeStreamingGenerate` + `finalizeGenerateReply`，助理/工作台只负责把消息写入各自 store。

## Risks

- 旧工作台气泡若曾写进助理 session，解耦后不再续聊那条内核历史；工作台自己的 lane 是新历史。可接受。
