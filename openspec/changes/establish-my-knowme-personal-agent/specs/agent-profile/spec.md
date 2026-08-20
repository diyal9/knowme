## MODIFIED Requirements

### Requirement: Agent profile configuration

Agent Profile MUST 以 v3 兼容读取旧版本，并支持 `profileKind`、身份、工作情境、任务偏好、角色职责、启用的 Skill、模型策略、连接器、记忆策略、输出协议、预算和并发限制。

#### Scenario: Read a v2 profile

- **WHEN** Store 读取缺少 v3 字段的 v2 Profile
- **THEN** Reader 以 `overlay` 默认值规范化并保留既有能力与策略
- **AND** 只有再次保存时才写出 v3

#### Scenario: Save the personal profile

- **WHEN** 用户保存 `my-knowme` 的身份或情境
- **THEN** 系统生成 v3 Profile 与新的稳定 Hash
- **AND** 既有 memoryPolicy、knowledgePolicy 与 permissions 继续参与快照

### Requirement: Agent profile snapshot

Agent 任务与 Workflow 执行 MUST 保存 Agent Profile 的类型、身份、情境、Skill、连接器版本和权限摘要，后续运行不得静默替换这些引用。

#### Scenario: Snapshot a contextual profile

- **WHEN** 系统为带 `contextId` 的 Profile 创建快照
- **THEN** 快照包含 Profile v3 Hash 与选中情境的稳定引用
- **AND** 不包含完整个人记忆或个人凭据
