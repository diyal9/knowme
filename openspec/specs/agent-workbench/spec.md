# Spec: Agent Workbench

## Purpose

在右侧提供用户侧「工作台」：上半为岗位配套的 Agent 助手，下半为多源工作事项（飞书等）。左侧保持 Agent 对话列。工作台 **不是** 仅指 agent-workbench 编排引擎 UI；动态编排将通过对话结构化提问实现（后续 Story）。

## Requirements

### Requirement: Workbench entry from Ribbon

Ribbon 按钮 `#btnRailAi` MUST 作为「工作台」入口；点击 MUST 切换 `mode-workbench`，且状态 MUST 持久化。入口图标 MUST 使用完整 Lucide 24 viewBox 的 `workbench`（layout-grid）图标。

#### Scenario: Toggle workbench on

- **WHEN** 用户点击 Ribbon 工作台按钮
- **THEN** `#appShell` 获得 `mode-workbench`，右侧显示工作台，左侧 Agent 对话列仍可见，按钮呈激活态

#### Scenario: Restore after restart

- **WHEN** 用户在工作台开启状态下重启应用
- **THEN** 工作台模式按持久化状态恢复

### Requirement: User workbench surface

工作台主体 MUST 分为上半 Agent 助手区与下半工作事项区。MUST NOT 将入口或顶栏命名为 AgentTeams。

#### Scenario: Stacked assistants and items

- **WHEN** 用户进入工作台模式
- **THEN** 上半为 Agent 助手，下半为工作事项区

### Requirement: Compact agent cards and detail drawer

上半 MUST 以简洁卡展示 Agent（标题 + 一行角色）；点击 MUST 在助手区内打开详情抽屉（完整描述等），MUST NOT 占用下半事项区。再点同一卡或关闭 MUST 收起抽屉。

#### Scenario: Open detail drawer

- **WHEN** 用户点击某助手简洁卡
- **THEN** 助手区内展开详情，下半工作事项区仍可见

#### Scenario: Refresh roster

- **WHEN** 用户点击刷新
- **THEN** 重新加载助手列表；若原选中仍存在则保持详情

### Requirement: Agent roster from external source

助手 MUST 从外部 workbench 项目（默认 `D:\workflows\workbench`，可经 `workbenchRoot` 覆盖）只读加载；卡片 MUST 展示标题与角色，详情 SHOULD 展示描述与节点标签。

#### Scenario: Render agent cards

- **WHEN** 工作台首次进入且外部目录可读
- **THEN** 助手区列出各 Agent

#### Scenario: Missing external directory

- **WHEN** 外部 workbench 目录不存在
- **THEN** 工作台不崩溃，提示未能加载

### Requirement: Work items area

下半工作事项区 MUST 存在；本期 MAY 为空态，提示飞书等来源后续接入。MUST NOT 在此区展示编排 DAG / 运行日志。

#### Scenario: Empty work items

- **WHEN** 尚无外部事项源
- **THEN** 下半显示「暂无事项」类空态，不展示假运行控件

### Requirement: Read-only surface

工作台 MUST NOT 写回外部 workbench 的 `workflow-spec/` 或修改外部文件。

#### Scenario: No external writes

- **WHEN** 用户浏览助手或刷新
- **THEN** 外部 workbench 目录不被修改

### Requirement: Deferred dynamic orchestration

工作台 MUST 支持从总览、管线详情、Agent 详情或新建运行入口进入专业管线选择、Agent Graph 草案和确认流程；Agent Profile 的创建/编辑/调优 MUST 仅在能力界面进行，工作台 Agent 详情 MUST 为只读展示并提供「前往能力界面调优」跳转。动态编排 MUST 使用已安装且已授权的 Agent 与 Skill 生成可解释 Graph，并在执行前完成 Graph、Agent 引用、handoff、权限和治理校验。客户端不得直接执行未经确认的任意 Graph。固定专业管线、个人工作流和 Daemon workflow MUST 通过统一 Workflow Package 表达，并保持明确的执行来源。

#### Scenario: Goal routes to workflow choices

- **WHEN** 用户在工作台输入目标
- **THEN** 工作台显示匹配的专业管线、个人工作流、可用 Agent 和 Graph 编排入口

#### Scenario: Dynamic orchestration from workbench

- **WHEN** 用户选择动态 Agent 协作
- **THEN** 工作台展示 Agent Graph 草案、节点职责、执行关系、能力版本和确认入口

#### Scenario: Confirmed dynamic orchestration

- **WHEN** 用户确认通过校验的 Agent Graph
- **THEN** 工作台创建本地 Team Run 或指定后端 Run，并将真实 Run Tree 状态投影到任务区域

#### Scenario: Invalid dynamic orchestration

- **WHEN** Graph 引用未知 Agent/Skill、包含环或不满足治理约束
- **THEN** 工作台阻止执行并保留可修订的 Graph 草案

#### Scenario: Workflow source remains explicit

- **WHEN** 用户启动 Daemon 专业管线或本地个人工作流
- **THEN** 运行区域分别显示专业管线与 Daemon 后端、本地工作流与 Local Team Runtime，不得混淆二者

#### Scenario: Continue with an Agent

- **WHEN** 用户带着当前目标在 Agent 详情弹窗查看某位专家
- **THEN** 工作台提供只读简介与「用此 Agent 继续」入口，并提供「前往能力界面调优 Agent」跳转；MUST NOT 提供 Profile 编辑或保存

### Requirement: Workbench has no top-level tabs

工作台一级 MUST NOT 提供工作模式 Tab。默认落地为单一工作流货架。

#### Scenario: No tabs on entry

- **WHEN** 用户从 Rail 进入工作台
- **THEN** 顶部无工作模式 Tab，内容区首屏即工作流货架

### Requirement: Orchestration is a first-class workbench action

编排 MUST 是工作台一级动作（货架「新建工作流」/ 卡片「编辑」进入），MUST NOT 埋在管理抽屉。节点候选来自能力界面 Agent store。节点检查器 MUST 仅设置该步骤的目标 / 角色，MUST NOT 提供 Agent 本身的 Skill / 知识 / Tool 配置。保存后工作流以「我的」来源即时进入货架。

#### Scenario: New workflow lands on shelf

- **WHEN** 用户从货架「新建工作流」拖入 Agent 连成 DAG 并保存
- **THEN** 该工作流以「我的」标签即时出现在同一货架，无需刷新

#### Scenario: Node inspector only sets step goal

- **WHEN** 用户点击编排中的某个 Agent 节点
- **THEN** 检查器仅可设置该步骤目标 / 角色，不出现 Skill / 知识 / Tool 的配置项（跳转能力界面调优）

### Requirement: Management drawer reduced to backend and automation

管理抽屉 MUST 仅含「执行后端(Daemon)」与「自动化」两面板。智能体管理面板 MUST 撤销。

#### Scenario: Drawer has two panels

- **WHEN** 用户打开管理抽屉
- **THEN** 只有执行后端与自动化两个分区，无智能体管理
