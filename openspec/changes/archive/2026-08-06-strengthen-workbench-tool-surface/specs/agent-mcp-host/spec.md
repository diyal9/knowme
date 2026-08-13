## ADDED Requirements

### Requirement: Streamable HTTP transport

MCP Host MUST 支持 `transport: stdio | streamable-http`；HTTP 配置含 `url`、headers、可选 OAuth profile id；与 stdio connector 可并存。

#### Scenario: HTTP list tools

- **WHEN** enabled MCP connector 使用 streamable-http 且 health 正常
- **THEN** Host 通过 HTTP 列出 tools 并投影到 Agent

#### Scenario: HTTP timeout and retry

- **WHEN** HTTP 请求超时
- **THEN** 返回 `timeout` 并对 list/call 做有限重试
- **AND** 连续失败 MUST 标记 connector health=degraded

### Requirement: OAuth token storage for MCP

HTTP MCP connector MAY 声明 `oauthProfile`；token MUST 存 `%APPDATA%\KnowMe\mcp-oauth/<connectorId>.json`；刷新失败 MUST 提示重新授权。

#### Scenario: Expired token blocks call

- **WHEN** access token 过期且 refresh 失败
- **THEN** 工具调用返回 `auth_required`
- **AND** Hub 展示重新连接入口

### Requirement: MCP schema cache

Host MUST 缓存各 connector 的 tools/list 结果到 `%APPDATA%\KnowMe\mcp-schemas/`，TTL 默认 24h；缓存失效或 connector 变更时 MUST 刷新。

#### Scenario: Offline schema read

- **WHEN** MCP server 暂不可达但缓存有效
- **THEN** Hub preview MAY 使用缓存 schema 并标注 stale

### Requirement: Install enable and health check

Hub 启用 MCP connector 前 MUST 运行 health check（initialize + list tools）；失败 MUST 阻止启用或保留 disabled 并展示原因。

#### Scenario: Enable runs health

- **WHEN** 用户启用新 MCP connector
- **THEN** 主进程执行 health check
- **AND** 成功后才加入 Agent 投影

## MODIFIED Requirements

### Requirement: Host runs in main process

KnowMe MUST speak MCP over stdio **or streamable-http** from the Electron main process and MUST NOT expose a generic MCP transport to the renderer. Host MUST 支持**多 MCP 连接器并行**，每个 enabled connector 维护独立 client session。

#### Scenario: List tools from configured server

- **WHEN** an enabled MCP connector has a command and allowlist
- **THEN** the Host lists tools and projects only allowlisted names into the Agent tool table with prefix `mcp.<connectorId>.`

#### Scenario: Multiple MCP connectors parallel

- **WHEN** 两个 enabled MCP connector A 与 B 均有 allowlist
- **THEN** Agent tool 表同时含 A 与 B 的 allowlisted 工具，命名空间不冲突

#### Scenario: Empty allowlist

- **WHEN** MCP connector allowlist is empty
- **THEN** no MCP tools are offered to the model

#### Scenario: HTTP connector parallel with stdio

- **WHEN** 一个 stdio 与一个 HTTP MCP connector 均 enabled
- **THEN** 两者工具均按命名空间投影且不共享 session 状态
