## ADDED Requirements

### Requirement: Connector settings stay configuration-only
连接器设置界面 MUST 只展示连接配置、授权与连接状态，MUST NOT 承载具体 Agent 写入草稿的批准或拒绝操作。具体写入审批 MUST 保留在发起操作的 Agent 执行上下文或工作台 draft inbox 中。

#### Scenario: Feishu write draft created during Agent execution
- **WHEN** Agent 创建需要用户确认的飞书写入或权限申请草稿
- **THEN** 执行上下文展示批准与拒绝入口
- **AND** 连接器设置界面不展示该草稿

#### Scenario: Existing pending drafts remain stored
- **WHEN** 用户升级后仍有未处理的待审批草稿
- **THEN** 系统保留草稿数据和统一审批能力
- **AND** 不在连接器设置界面提供审批入口

### Requirement: Connector settings hide internal placeholder identities
当内置连接器已经有专用配置区域时，设置页通用连接器列表 MUST NOT 重复展示该连接器的内部占位 ID 或未配置模板行。

#### Scenario: Built-in MCP is not configured
- **WHEN** 用户打开连接器设置且内置 MCP 尚未填写启动配置
- **THEN** 页面只展示面向用户的公司 MCP 配置区域
- **AND** 不展示 `mcp-default` 通用连接器行

#### Scenario: Built-in MCP is configured
- **WHEN** 用户已经保存内置 MCP 配置
- **THEN** 专用配置区域加载已保存配置
- **AND** 通用连接器列表仍不重复展示内置占位行
