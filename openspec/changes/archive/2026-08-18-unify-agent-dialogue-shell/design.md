## Context

`ai-generate` 内核已按 agentId 分流 writing/steward/coding 与工具面。渲染层助理走 `startAssistantGenerate` + `beginAssistantStream`；工作台走独立 store，消息在 `expertRoom`/`run`。

## Decisions

1. 共享 **流式归约**（`applyRuntimeStreamEvent`），按消息 id 写入当前对话槽，不把工作台消息塞进助理 sessionStates。
2. 共享 **气泡与 ContentView**；工作台自己的空态/快捷（专家卡片）留在 `ExpertCollabDialogue`。
3. LLM/工具/权限继续只在主进程；工作台 payload 带 `task` + `agentId=expertId`。

## Risks

- `sessionId` 过滤器：工作台仍传 `activeSessionId`，与 IPC envelope 一致即可。
