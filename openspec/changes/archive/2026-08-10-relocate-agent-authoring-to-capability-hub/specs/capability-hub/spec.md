## ADDED Requirements

### Requirement: Capability hub is the sole home for agent authoring

能力界面 MUST 是创建、编辑、调优 Agent（专家）的唯一场所。MUST 区分来源：官方(curated)、自建(local)。MUST 允许为 Agent 配置 Skill、专属知识库范围与 Tool（连接器）。工作台及助理 MUST NOT 再提供 Agent 的创建/编辑/调优入口。

#### Scenario: Create a custom agent

- **WHEN** 用户在能力界面专家页选择「添加自己的专家」
- **THEN** 进入 Agent 创建表单，可设 persona、Skill、知识库范围与 Tool，保存后作为「自建」出现在专家列表

#### Scenario: Tune an agent

- **WHEN** 用户对某专家点「调优」
- **THEN** 在能力界面内配置其 Skill / 知识库范围 / Tool，保存后配置随该 Agent 持久化

#### Scenario: Official agents are read-only

- **WHEN** 用户查看 curated 官方专家
- **THEN** 可「复制为自建」再调优，MUST NOT 直接修改官方版本

### Requirement: Installed agents feed workbench orchestration

在能力界面安装或自建的 Agent MUST 进入统一 Agent store，并作为工作台编排的节点候选。MUST NOT 要求用户在工作台再次登记 Agent。

#### Scenario: Installed agent appears in orchestration

- **WHEN** 用户在能力界面安装或新建一个 Agent，随后进入工作台编排
- **THEN** 该 Agent 出现在编排节点候选库，可拖入 DAG

### Requirement: Real agent catalog

能力界面专家目录 MUST 反映真实 Agent 数据（本地 + 官方种子），MUST NOT 使用占位 / Mock 数据充数。

#### Scenario: No mock experts

- **WHEN** 用户打开能力界面专家页
- **THEN** 列表为真实可用/可安装的 Agent，不含仅用于演示的占位条目
