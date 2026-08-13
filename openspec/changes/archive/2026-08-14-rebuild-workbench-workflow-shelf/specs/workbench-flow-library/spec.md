## MODIFIED Requirements

### Requirement: Flow actions

每个流程 MUST 提供唯一的主操作用于启动；复制并自定义、查看历史运行等次要动作 MUST 收纳在卡片的次级菜单中，MUST NOT 与主操作并列争夺点击。不可执行流程的主操作 MUST 禁用，并 MUST 提供修复缺失依赖的入口。

#### Scenario: Copy an official flow

- **WHEN** 用户从卡片次级菜单选择复制专业管线
- **THEN** 系统创建个人草稿并打开编排或配置入口

#### Scenario: Repair unavailable flow

- **WHEN** 流程缺少 Skill、Agent、连接器或后端
- **THEN** 系统列出缺失项并提供安装、配置或改用其他流程的操作

#### Scenario: Primary action is unambiguous

- **WHEN** 用户查看任一流程卡片
- **THEN** 卡片上只有一个用于启动的主操作，其余动作位于次级菜单内

### Requirement: Pipeline master-detail console

流程库 MUST 以卡片货架形式呈现，卡片自身即承载启动决策所需的全部信息（产出、所需输入、可运行状态、来源），MUST NOT 要求用户先在详情面板中查看才能判断是否可用。列表 MUST 支持领域、来源与关键词筛选，且进入时 MUST NOT 预先应用任何筛选。工作流的完整细节（步骤、质量门禁、最近运行）MUST 可按需查看，且查看动作不得隐式启动运行。

#### Scenario: Inspect before launch

- **WHEN** 用户在货架上查看一个 Workflow Package 的完整细节
- **THEN** 系统显示该版本的执行信息与 readiness，且“查看”不会隐式启动运行

#### Scenario: Unavailable pipeline

- **WHEN** 选中管线存在依赖阻塞
- **THEN** 主启动操作禁用，并列出真实修复动作

#### Scenario: Card carries the decision

- **WHEN** 用户浏览货架而未打开任何详情
- **THEN** 每张卡片已显示产出、所需输入与可运行状态，足以判断是否启动

### Requirement: Flow source distinction

流程库 MUST 区分官方、团队、个人和派生流程，并单独显示执行后端；不得把执行后端当作流程类别，也不得将其作为货架的分组或筛选维度。

#### Scenario: Display backend separately

- **WHEN** 用户查看一个由 Daemon 执行的专业管线
- **THEN** 系统将其显示为专业管线，并在执行信息中单独标注 Daemon 后端

#### Scenario: Backend is not a filter

- **WHEN** 用户使用货架筛选
- **THEN** 可选筛选维度为领域与来源，不包含执行后端

## REMOVED Requirements

### Requirement: Goal-aware flow discovery

**Reason**: 目标输入推荐是货架无货时期的补偿设计。它制造了与卡片启动并行的第二条启动路径，是七个入口混乱的主要来源之一。供给侧修复后货架直接有货，用户按结果浏览卡片即可，不需要先描述目标再等推荐。

**Migration**: 目标输入框降级为货架的关键词搜索框，只筛选不启动。此前依赖「输入目标 → 推荐流程 → 启动」路径的入口（助理快捷卡、悬浮球）改为跳转货架并预填搜索关键词，由用户在卡片上确认启动。能力缺口提示改由货架的诚实空状态与卡片的未就绪标注承担，见 `workbench-workflow-shelf` 的 Honest empty state 与 Runnability is judged per workflow。
