# Delta Spec: agent-mcp-host

## MODIFIED Requirements

### Requirement: Host runs in main process

KnowMe MUST speak MCP over stdio from the Electron main process and MUST NOT expose a generic MCP transport to the renderer. Host MUST 支持**多 MCP 连接器并行**，每个 enabled connector 维护独立 stdio client。

#### Scenario: List tools from configured server

- **WHEN** an enabled MCP connector has a command and allowlist
- **THEN** the Host lists tools and projects only allowlisted names into the Agent tool table with prefix `mcp.<connectorId>.`

#### Scenario: Multiple MCP connectors parallel

- **WHEN** 两个 enabled MCP connector A 与 B 均有 allowlist
- **THEN** Agent tool 表同时含 A 与 B 的 allowlisted 工具，命名空间不冲突

#### Scenario: Empty allowlist

- **WHEN** MCP connector allowlist is empty
- **THEN** no MCP tools are offered to the model

### Requirement: Tool calls are bounded

MCP tool results MUST be truncated like other Agent tools and count toward the existing per-run tool call budget.

#### Scenario: Call projected tool

- **WHEN** the model calls an allowlisted MCP tool
- **THEN** the Host executes `tools/call` and returns text content to the tool loop

## ADDED Requirements

### Requirement: Hub tools preview reflects MCP host state

Capability Hub 连接器抽屉 MUST 可请求主进程列出该 connector 的 MCP tools（preview），与 Agent 投影一致（仍受 allowlist 过滤展示）。

#### Scenario: Tools preview in drawer

- **WHEN** 用户在 Hub 打开某 MCP 连接器详情且 health 正常
- **THEN** 抽屉展示可勾选 allowlist 的工具列表 preview

### Requirement: Connector lifecycle hooks

MCP Host MUST 在 connector enabled/disabled/uninstalled 时 connect/disconnect 对应 client，避免僵尸进程。

#### Scenario: Disable disconnects client

- **WHEN** 用户在 Hub 禁用某 MCP connector
- **THEN** Host 断开该 stdio client 且 Agent 工具表移除其工具
