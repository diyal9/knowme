## ADDED Requirements

### Requirement: 助理发送走 Agent Runtime 契约

助理发送 MUST 预先分配 `runId`，并在 `aiGenerate` 中携带 `sessionId`、`agentId`、`runId`、`contentGrounding` 与 prompt 中的 skill refs。生成期间 MUST 可用该 `runId` 取消。

#### Scenario: 发送时带上 run 与模式

- **WHEN** 用户在通用模式会话中发送一条消息
- **THEN** `aiGenerate` 入参包含非空 `runId`、当前会话 `sessionId` 与 `agentId`

### Requirement: v2 流式归约驱动消息

助理 MUST 用 AgentMessageState 归约带 `version` 的流式事件。协议 v2 消息 MUST NOT 用 raw chunk 覆盖 `answer.committed` 正文。

#### Scenario: stage 进入执行时间线且正文来自 committed

- **WHEN** 运行发出 v2 `stage` 随后 `answer.committed`
- **THEN** 气泡时间线包含该 stage，正文等于 committed text
