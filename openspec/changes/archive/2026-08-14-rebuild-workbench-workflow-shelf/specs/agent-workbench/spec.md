## MODIFIED Requirements

### Requirement: Workbench entry from Ribbon

Ribbon 的工作台按钮 `#btnRailWorkbench` MUST 作为「工作台」入口；点击 MUST 切换 `mode-workbench`，且状态 MUST 持久化。入口图标 MUST 使用完整 Lucide 24 viewBox 的 `workbench`（layout-grid）图标。助理入口 `#btnRailAi` MUST 与工作台入口区分，MUST NOT 互为别名。

#### Scenario: Toggle workbench on

- **WHEN** 用户点击 Ribbon 工作台按钮
- **THEN** `#appShell` 获得 `mode-workbench`，右侧显示工作台货架，左侧 Agent 对话列仍可见，按钮呈激活态

#### Scenario: Restore after restart

- **WHEN** 用户在工作台开启状态下重启应用
- **THEN** 工作台模式按持久化状态恢复

### Requirement: User workbench surface

工作台主体 MUST 只有「货架」与「运行」两个状态，不得再划分为上下两个固定区块，也不得提供一级 Tab 导航。智能体管理、编排工作室、执行后端状态与自动化 MUST 作为货架页内的次级入口提供，MUST NOT 与货架平级。MUST NOT 将入口或顶栏命名为 AgentTeams。

#### Scenario: Shelf and run are the only states

- **WHEN** 用户进入工作台模式
- **THEN** 工作台处于货架状态；启动某个工作流后切换为运行状态；除此之外不存在其他一级视图

#### Scenario: Management is secondary

- **WHEN** 用户需要管理智能体或编排新工作流
- **THEN** 通过货架页的管理入口进入对应面板，货架本身不因此被替换为 Tab 集合

### Requirement: Deferred dynamic orchestration

工作台 MUST 支持从货架卡片进入专业管线运行、Agent Profile 配置或 Agent Graph 草案和确认流程；动态编排 MUST 使用已安装且已授权的 Agent 与 Skill 生成可解释 Graph，并在执行前完成 Graph、Agent 引用、handoff、权限和治理校验。客户端不得直接执行未经确认的任意 Graph。固定专业管线、个人工作流和 Daemon workflow MUST 通过统一 Workflow Package 表达，并保持明确的执行来源。

#### Scenario: Shelf card routes to the run

- **WHEN** 用户在货架上对某个工作流执行主操作
- **THEN** 工作台进入该工作流的运行视图，展示所需输入、参与 Agent 与执行后端

#### Scenario: Dynamic orchestration from workbench

- **WHEN** 用户选择动态 Agent 协作
- **THEN** 工作台展示 Agent Graph 草案、节点职责、执行关系、能力版本和确认入口

#### Scenario: Confirmed dynamic orchestration

- **WHEN** 用户确认通过校验的 Agent Graph
- **THEN** 工作台创建本地 Team Run 或指定后端 Run，并将真实 Run Tree 状态投影到运行视图

#### Scenario: Invalid dynamic orchestration

- **WHEN** Graph 引用未知 Agent/Skill、包含环或不满足治理约束
- **THEN** 工作台阻止执行并保留可修订的 Graph 草案

#### Scenario: Workflow source remains explicit

- **WHEN** 用户启动 Daemon 专业管线或本地个人工作流
- **THEN** 运行视图分别显示专业管线与 Daemon 后端、本地工作流与 Local Team Runtime，不得混淆二者

#### Scenario: Continue with an Agent

- **WHEN** 用户带着当前上下文在管理区选择一个 ready 的 Agent Profile
- **THEN** 工作台提供“用此 Agent 新建运行”或“开始会话”的真实入口，并将上下文与 Profile 快照传入后续流程

## REMOVED Requirements

### Requirement: Compact agent cards and detail drawer

**Reason**: 描述的是工作台「上半 Agent 助手区 + 下半事项区」的旧布局，该布局在多轮改版中已被移除，对应 DOM 不复存在，规格与实现已长期脱节。新架构下 Agent 不再占据工作台主区，而是位于管理区的智能体面板。

**Migration**: Agent 的浏览与详情查看迁移至管理区的智能体管理面板，其行为由 `agent-profile` 与 `agent-composition-studio` 规格约束。

### Requirement: Agent roster from external source

**Reason**: 依赖外部目录 `D:\workflows\workbench` 只读加载 Agent 的机制已被 Agent Package、Expert Runtime 与 Daemon Agent 目录取代，该路径不再是 Agent 的来源。

**Migration**: Agent 来源由 Expert Runtime 与 Daemon Agent 目录提供；工作流对 Agent 的引用解析要求见 `workflow-supply` 的 Agent references resolve or are declared missing。

### Requirement: Work items area

**Reason**: 「下半工作事项区」随上下分区布局一并移除。其承载的待处理与进行中信息在新架构下由货架上的进行中运行入口与运行视图承担。

**Migration**: 待处理与进行中运行的呈现改由 `workbench-workflow-shelf` 的 Return and resume 约束，货架显示进行中运行数量与返回入口。
