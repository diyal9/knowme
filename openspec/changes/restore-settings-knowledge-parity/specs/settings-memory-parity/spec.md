## ADDED Requirements

### Requirement: Settings memory tab matches baseline

设置「我的记忆」MUST 包含：KnowMe 如何理解我（行业选择、关于我、协作偏好）、适应我的工作方式开关与统计、等你确认的推测、工作记忆整合、近期记忆、打开记忆目录、一键遗忘。个人资料保存 MUST 走底部「保存设置」。

#### Scenario: Open memory tab

- **WHEN** 用户打开设置并切换到「我的记忆」
- **THEN** 可见「关于我」「协作偏好」「行业」与「适应我的工作方式」
- **AND** 「助手模式」不再重复展示「关于我」区块

#### Scenario: Review a learned pattern

- **WHEN** overview 返回一条 `pending` 推测
- **THEN** 用户可接受或忽略
- **AND** 调用 `memoryReviewPattern`

#### Scenario: Clear auto memory

- **WHEN** 用户确认「一键遗忘」
- **THEN** 调用 `memoryClear`
- **AND** 确认文案说明不影响个人资料和项目知识库

### Requirement: Other settings tabs match baseline

设置其余 Tab MUST 对照 `f6ad048` 的内容源、AI、助手、系统、连接器、关于分区：git 提示、DashScope 说明、打开专家库与四模式提示词、组织远程配置与知识库备份、飞书授权确认、公司 MCP、Workbench 授权与部署、关于页版本与开发者联系方式。

#### Scenario: Open connectors tab

- **WHEN** 用户切换到「连接器」
- **THEN** 可见飞书一键授权、公司 MCP 与 Workbench 授权表单

#### Scenario: Open assistant tab

- **WHEN** 用户切换到「助手模式」
- **THEN** 可见「打开专家库」与四种模式约束输入
