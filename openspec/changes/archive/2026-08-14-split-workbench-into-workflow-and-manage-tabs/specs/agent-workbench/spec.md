## ADDED Requirements

### Requirement: Workbench splits into workflow and manage tabs

工作台一级 MUST 提供且仅提供「工作流」与「管理」两个 Tab，长在顶栏内部、标题右侧左对齐，默认停在「工作流」。「进行中」与「刷新」MUST 跨 Tab 共用；搜索框 MUST 仅在「工作流」Tab 显示。运行页与编排页 MUST NOT 显示这两个 Tab（它们各有返回入口）。

#### Scenario: Two tabs on entry

- **WHEN** 用户从 Rail 进入工作台
- **THEN** 顶栏出现「工作流 / 管理」两个 Tab，默认选中「工作流」，内容区是工作流货架

#### Scenario: Search is scoped to the workflow tab

- **WHEN** 用户在「工作流」Tab 输入搜索词后切到「管理」Tab
- **THEN** 顶栏搜索框隐藏；切回「工作流」Tab 时搜索框恢复且原搜索词保留

#### Scenario: Tabs hidden inside run and orchestration

- **WHEN** 用户进入运行页或编排页
- **THEN** 两个 Tab 隐藏，返回后重新出现

### Requirement: Manage tab is a resident surface with three sections

管理 MUST 是常驻 Tab surface，MUST NOT 是顶栏下拉唤起的右滑抽屉。其二级分区 MUST 依次为「工作流」「执行后端」「自动化」，默认停在「工作流」。工作流分区 MUST 提供「新建工作流」入口与「我的」工作流（personal / forked）列表，每条 MUST 可编辑（进入编排）与删除（下架）；删除后该工作流 MUST 同时从货架消失。列表为空时 MUST 给出可自造血的空态（新建，或去货架复制团队流程）。

#### Scenario: Manage tab opens on workflows section

- **WHEN** 用户点击「管理」Tab
- **THEN** 进入常驻管理面，二级分区依次为「工作流 / 执行后端 / 自动化」，默认停在「工作流」

#### Scenario: Deleting a personal workflow clears the shelf card

- **WHEN** 用户在管理 Tab 的工作流分区删除一条「我的」工作流
- **THEN** 该条目从列表移除，切回「工作流」Tab 后货架上也不再有该卡片

#### Scenario: Empty personal workflow list stays actionable

- **WHEN** 用户没有任何「我的」工作流
- **THEN** 工作流分区显示空态，并提供「新建工作流」与「去货架复制团队流程」两个可点击入口

#### Scenario: External navigation still lands on a manage section

- **WHEN** 其他界面调用工作台跳转到 `daemon` 或 `automation`
- **THEN** 工作台切到「管理」Tab 并直接落在对应二级分区

## MODIFIED Requirements

### Requirement: Orchestration is a first-class workbench action

编排 MUST 是工作台一级动作：入口为管理 Tab 工作流分区的「新建工作流」、货架空态的「新建工作流」、以及货架「我的」卡片的「编辑」。货架筛选行 MUST NOT 再放「新建工作流」按钮（筛选行只承载筛选）。节点候选来自能力界面 Agent store。节点检查器 MUST 仅设置该步骤的目标 / 角色，MUST NOT 提供 Agent 本身的 Skill / 知识 / Tool 配置。保存后工作流以「我的」来源即时进入货架。

#### Scenario: New workflow lands on shelf

- **WHEN** 用户从管理 Tab 工作流分区点「新建工作流」，拖入 Agent 连成 DAG 并保存
- **THEN** 该工作流以「我的」标签即时出现在「工作流」Tab 的货架，无需刷新

#### Scenario: Filter row carries filters only

- **WHEN** 用户查看「工作流」Tab 的筛选行
- **THEN** 只有领域筛选与清除筛选，没有「新建工作流」按钮

#### Scenario: Node inspector only sets step goal

- **WHEN** 用户点击编排中的某个 Agent 节点
- **THEN** 检查器仅可设置该步骤目标 / 角色，不出现 Skill / 知识 / Tool 的配置项（跳转能力界面调优）

## REMOVED Requirements

### Requirement: Workbench has no top-level tabs

**Reason**: 工作台缺少承载「管」这条常驻路径的面，无 Tab 主张导致管理只能做成临时抽屉。
**Migration**: 由「Workbench splits into workflow and manage tabs」取代；货架本身仍是默认落地面，仅在其上方增加两条一级 Tab。

### Requirement: Management drawer reduced to backend and automation

**Reason**: 抽屉形态表达「临时浮层」，与常驻管理路径不符。
**Migration**: 由「Manage tab is a resident surface with three sections」取代；执行后端与自动化两面板内容不变，作为二级分区迁入管理 Tab，并在其前新增「工作流」分区。
