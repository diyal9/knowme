## ADDED Requirements

### Requirement: Agent skill refs use profile contract

专家节点「本步骤技能」MUST 持久化到 `profile.skillRefs`，MUST 能读回旧包中的 skillRefs。

#### Scenario: Toggle skill persists

- **WHEN** 用户勾选技能并保存工作流后再打开
- **THEN** 该技能仍为勾选状态

### Requirement: Condition compare ops match baseline

条件节点比较 MUST 提供等于 / 不等于 / 包含 / 为空，字段名为 `config.compare`。

#### Scenario: Select not equal

- **WHEN** 用户将比较设为不等于
- **THEN** 节点 `config.compare` 为 `not_equal`

### Requirement: Condition wire carries branch semantics

从条件「成立 / 不成立」端口拖线 MUST 写入对应 branch，边标签可读。

#### Scenario: Wire true branch

- **WHEN** 用户从条件成立端口连到下游
- **THEN** 边 `branch` 为 `true` 且展示「成立」

### Requirement: Inspector appears only when node selected

未选中节点时 MUST NOT 渲染右侧属性栏（对齐基线 hidden）；点选画布节点后 MUST 在右侧展示该节点字段。

#### Scenario: No selection

- **WHEN** 编排已打开且无选中节点
- **THEN** 页面无 `studio-inspector`，布局为双栏（组件 + 画布）

#### Scenario: Select knowledge node

- **WHEN** 用户点选知识库节点
- **THEN** 右侧出现知识库字段（名称 / 知识库 / 检索目标），且不出现流程定义入出参块

### Requirement: Workflow IO only on start and end

流程名称、目标与入出参 MUST 仅在开始/结束节点配置：开始侧重入参，结束侧重出参。

#### Scenario: Start shows inputs only

- **WHEN** 用户选中开始节点
- **THEN** 可见入参结构编辑，不可见出参结构编辑
