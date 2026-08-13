## ADDED Requirements

### Requirement: Skill references in Agent Profile snapshots

Agent Profile 和 Workflow Package MUST 保存所启用 Skill 的版本、内容哈希、治理摘要和触发方式；运行时 MUST 根据快照解析 Skill，不得静默使用当前目录中的不同版本。

#### Scenario: Snapshot enabled skills

- **WHEN** 用户保存 Agent Profile 或确认工作流
- **THEN** 系统保存每个启用 Skill 的版本、哈希和权限摘要

#### Scenario: Skill version drift

- **WHEN** 历史工作流引用的 Skill 当前版本发生变化
- **THEN** 系统提示版本漂移，并要求用户确认升级或继续使用历史快照

### Requirement: Skill availability in workflow validation

Graph 或 Workflow Package 校验 MUST 检查每个 Skill 的 enabled 状态、依赖、风险和执行权限；不满足条件时 MUST fail closed。

#### Scenario: Disabled skill blocks run

- **WHEN** 工作流引用已禁用 Skill
- **THEN** 校验失败并指出对应 Agent 和 Skill，且不创建 Run

#### Scenario: Skill risk requires gate

- **WHEN** 工作流启用需要审批的高风险 Skill
- **THEN** 工作流预览显示审批 Gate，未经确认不得执行副作用操作
