## ADDED Requirements

### Requirement: Knowledge entries open for reading

工作台知识库 MUST 允许用户打开 Wiki/OKF 条目或检索命中，展示标题与正文。

#### Scenario: Open wiki entry

- **WHEN** 用户点击一条知识条目
- **THEN** 调用 `knowledgeOsRead`
- **AND** 展示该条目标题与正文，并可返回列表

#### Scenario: Open search hit

- **WHEN** 检索结果中有带 path 的命中且用户点击
- **THEN** 同样打开正文预览

### Requirement: Knowledge health and organize entry points

知识库 MUST 提供健康检查与「开始 AI 整理」，空态 MUST 引导用户到设置「内容源」。

#### Scenario: Lint knowledge

- **WHEN** 用户点击健康检查
- **THEN** 调用 `knowledgeOsLint` 并展示问题数或通过状态

#### Scenario: Start organize

- **WHEN** 用户点击开始 AI 整理
- **THEN** 调用 `knowledgeStewardTaskCreate` 并刷新 steward 列表

#### Scenario: Empty knowledge root

- **WHEN** Wiki/OKF 均无条目
- **THEN** 空态提示添加内容源或执行首次整理
- **AND** 不展示长技术路径堆砌
