## ADDED Requirements

### Requirement: Tool contracts expose research semantics
Tool Contract MAY 声明受控的研究语义标签，包括搜索、网页读取、知识检索及来源范围。研究路由 MUST 优先消费该语义，并 MAY 对缺少标签的连接器工具使用保守的名称与描述推断；推断结果 MUST NOT 提升工具权限或绕过 allowlist。

#### Scenario: Built-in search declares web-search semantics
- **WHEN** 内置联网搜索工具注册到 Tool Registry
- **THEN** 契约标记该工具为公开网络搜索能力
- **AND** 研究路由可在不硬编码工具名列表的情况下发现它

#### Scenario: Allowlisted MCP search tool is discovered
- **WHEN** 一个已启用 MCP 连接器只投影 allowlist 中的搜索工具
- **THEN** 研究路由只把实际投影的工具识别为可用来源
- **AND** 未投影的同连接器工具不出现在研究计划中
