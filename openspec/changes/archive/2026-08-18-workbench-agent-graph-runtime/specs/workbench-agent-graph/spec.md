## Purpose

让用户可以从一个目标出发，使用 KnowMe 已安装且已授权的 Agent 能力生成可解释、可确认、可校验的多 Agent Graph，而不是被限制在固定 Daemon 工作流或手动逐节点操作。

## ADDED Requirements

### Requirement: Goal-based graph proposal

工作台 MUST 根据用户目标和当前可用的 Expert/Agent 能力生成结构化 Graph 草案；草案 MUST 包含节点、节点类型、Agent 引用、输入输出关系和执行顺序。

#### Scenario: Generate a local Agent graph

- **WHEN** 用户输入目标并选择使用 KnowMe Agent 能力
- **THEN** 工作台展示由可用 Agent 组成的 Graph 草案，并显示每个节点的职责和预期交付物

#### Scenario: No matching capability

- **WHEN** 当前已安装能力无法形成满足目标的 Graph
- **THEN** 工作台说明缺少的能力，并提供调整目标、安装能力或改用 Daemon workflow 的可执行入口

### Requirement: User confirmation before execution

工作台 MUST 在执行动态 Graph 前展示确认界面；用户未确认时 MUST NOT 创建可执行的 Team Run。

#### Scenario: Confirm graph execution

- **WHEN** 用户确认 Graph、输入材料和权限边界
- **THEN** 工作台进入执行状态并记录确认后的 Graph 快照

#### Scenario: Edit graph before confirmation

- **WHEN** 用户在确认前移除 Agent、调整串并行关系或修改输入
- **THEN** 工作台重新校验 Graph，并只允许执行最新通过校验的版本

### Requirement: Composition validation

工作台 MUST 在执行前拒绝未知 Agent、重复节点标识、悬空边、环、非法节点类型、未闭合 handoff 和超过并行度/治理限制的 Graph。

#### Scenario: Reject invalid agent reference

- **WHEN** Graph 引用未安装、未授权或无法解析的 Agent
- **THEN** 工作台阻止执行并指出对应节点，不创建 Root Run

#### Scenario: Reject cyclic graph

- **WHEN** 用户编辑后的 Graph 包含环
- **THEN** 工作台显示校验失败，并保留 Graph 草案供用户修订

### Requirement: Graph snapshot and provenance

确认执行时 MUST 保存 Graph 版本、Agent Package 版本、内容哈希和用户目标；后续运行状态和结果 MUST 能追溯到该快照。

#### Scenario: Reopen a graph run

- **WHEN** 用户重新打开一个已创建的本地 Graph 任务
- **THEN** 工作台显示当时确认的节点、Agent 版本和目标，而不是使用当前能力目录覆盖历史事实
