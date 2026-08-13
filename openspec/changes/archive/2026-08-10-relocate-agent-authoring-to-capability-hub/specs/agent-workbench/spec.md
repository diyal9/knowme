## MODIFIED Requirements

### Requirement: Workbench has no top-level tabs

工作台一级 MUST NOT 提供工作模式 Tab。默认落地为单一工作流货架。（恢复无 Tab 主张，取代 add-workbench-work-mode-tabs 的两 Tab）

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

## REMOVED Requirements

### Requirement: Agent authoring in the workbench

**Reason**: Agent 的创建/编辑/调优迁入能力界面。
**Migration**: 工作台原 `wbAgentManagerForm` 能力迁至 `capability-hub`；工作台内相关入口改为跳转能力界面；助理「我的专家」降为只读消费。
