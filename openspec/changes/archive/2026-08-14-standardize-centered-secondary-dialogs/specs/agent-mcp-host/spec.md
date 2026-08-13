## MODIFIED Requirements

### Requirement: Hub tools preview reflects MCP host state

Capability Hub 连接器居中详情弹窗 MUST 可请求主进程列出该 connector 的 MCP tools（preview），与 Agent 投影一致（仍受 allowlist 过滤展示）。

#### Scenario: Tools preview in drawer

- **WHEN** 用户在 Hub 打开某 MCP 连接器详情且 health 正常
- **THEN** 居中详情弹窗展示可勾选 allowlist 的工具列表 preview
