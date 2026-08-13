## Purpose

把工作台收敛为一条主线：用户在货架上挑一个现成工作流，确认输入，跑起来，拿到产物。货架是工作台唯一的落地面，运行是唯一的接管态，其余功能一律降级为次级入口。

## ADDED Requirements

### Requirement: Shelf is the landing surface with two work-mode tabs

工作台 MUST 以工作流货架作为默认落地视图。工作台一级 MUST 只提供「团队管线 / 我的 Agent」两条工作模式 Tab（详见 `workbench-work-modes`），MUST NOT 恢复历史上的「开始工作 / 工作流 / 智能体管理 / Daemon 模式 / 运行」多 Tab 结构。工作台在任一时刻 MUST 只处于「货架」或「运行」两种状态之一。

> 由 `add-workbench-work-mode-tabs` 放宽：原「工作台一级 MUST NOT 提供 Tab 导航」改为允许且仅允许两条工作模式 Tab。

#### Scenario: Enter the workbench

- **WHEN** 用户从 Rail 进入工作台且没有正在恢复的运行
- **THEN** 系统展示工作流货架，顶部仅有「团队管线 / 我的 Agent」两条工作模式 Tab

#### Scenario: No legacy tab navigation exists

- **WHEN** 用户处于货架状态
- **THEN** 页面上不存在「开始工作 / 工作流 / 智能体管理 / Daemon 模式 / 运行」等历史一级 Tab，管理类功能仍通过管理入口进入次级面板

### Requirement: Card answers the three user questions

货架卡片 MUST 在不展开、不跳转的前提下回答三件事：这个工作流**产出什么**、**需要用户提供什么**、**现在能不能跑**。卡片 MUST 显示名称、一句话说明、产出摘要、所需输入摘要、可运行状态与来源（官方 / 团队 / 我的）。卡片 MUST NOT 把执行后端当作分类维度展示。

#### Scenario: Read a card without interaction

- **WHEN** 用户浏览货架
- **THEN** 每张卡片直接显示产出、所需输入与可运行状态，无需悬停、展开或进入详情

#### Scenario: Source is visible, backend is not a category

- **WHEN** 一个由 Daemon 执行的官方工作流出现在货架
- **THEN** 卡片将其归为「官方」，执行后端不作为分组或筛选类别出现在货架上

### Requirement: Runnability is judged per workflow

工作流是否可运行 MUST 依据该工作流自身的条件判定，包含 `status`、执行后端可达性、graph 或 agentRefs 是否完整、引用的 Agent 是否可解析。MUST NOT 使用所属领域的整体 readiness 代替单条工作流的判定。

#### Scenario: Domain readiness does not gate a runnable workflow

- **WHEN** 某工作流自身依赖全部满足，但其所属领域的整体 readiness 未达标
- **THEN** 该工作流仍显示为可运行，用户可以直接启动

#### Scenario: Unrunnable workflow states its blocker

- **WHEN** 某工作流因缺少 Agent、后端不可达或 graph 不完整而无法运行
- **THEN** 卡片显示不可运行，并明确指出缺失项，同时提供补齐该缺失项的入口

### Requirement: No default filtering on entry

进入货架时 MUST 展示当前 Tab 下全部可见工作流，MUST NOT 预先应用领域筛选或任何默认收窄条件。领域（仅团队管线 Tab）与关键词 MUST 作为用户主动收窄的手段提供。来源不再作为货架内筛选维度，而是由顶部两 Tab 承载（详见 `workbench-work-modes`）。

#### Scenario: Full shelf on first entry

- **WHEN** 用户首次进入工作台货架
- **THEN** 领域筛选处于「全部」状态，当前 Tab 下所有可见工作流均在列，不因默认领域而隐藏

#### Scenario: Narrowing is user-initiated

- **WHEN** 用户选择某个领域或输入关键词
- **THEN** 货架按该条件收窄，并明确显示当前生效的筛选条件与清除方式

### Requirement: Single launch entry

启动一个工作流的入口 MUST 唯一，即货架卡片上的主操作。系统 MUST NOT 提供并行的启动抽屉、顶栏启动按钮或独立的目标输入启动流程。搜索框 MUST 只用于筛选货架，MUST NOT 具备启动语义。工作台之外的入口（助理快捷卡、悬浮球等）MUST 通过跳转到货架并预填筛选条件来发起工作，MUST NOT 自带独立启动流程。

#### Scenario: Only the card starts work

- **WHEN** 用户处于货架状态
- **THEN** 页面上唯一能发起运行的控件是卡片主操作，不存在其他启动按钮或启动抽屉

#### Scenario: Search filters but does not launch

- **WHEN** 用户在货架搜索框输入内容并提交
- **THEN** 货架按关键词收窄，不启动任何运行

#### Scenario: External entry redirects to the shelf

- **WHEN** 用户从助理侧的快捷入口发起一项工作
- **THEN** 系统切换到工作台货架并预填对应筛选条件，由用户在卡片上确认启动

### Requirement: Run view is a three-stage takeover

从货架启动后 MUST 进入接管式运行视图，包含且仅包含三个阶段：确认输入、执行中、产物。运行视图 MUST 始终显示当前所处阶段与返回货架的退路。确认输入阶段 MUST 依据工作流的 `inputs` 生成表单，并展示将参与的 Agent 与实际使用的执行后端。

#### Scenario: Stage progression is visible

- **WHEN** 用户启动一个工作流
- **THEN** 运行视图显示「确认输入 → 执行中 → 产物」三段进度，并高亮当前阶段

#### Scenario: Inputs are derived from the workflow

- **WHEN** 工作流声明了输入项
- **THEN** 确认输入阶段为每个输入项生成对应表单控件，缺少必填项时不允许进入执行

#### Scenario: Participants disclosed before running

- **WHEN** 用户处于确认输入阶段
- **THEN** 系统展示本次将参与的 Agent 与实际执行后端，用户确认后才开始执行

### Requirement: Backend is decided by the system

执行后端 MUST 由系统依据可达性自动判定，MUST NOT 要求用户在启动前选择后端。系统 MUST 在运行视图内以只读方式告知本次实际使用的后端。

#### Scenario: No backend choice is presented

- **WHEN** 某工作流同时支持本地与 Daemon 后端且两者均可用
- **THEN** 系统自动选定其一并直接进入确认输入，不向用户提出后端选择

#### Scenario: Actual backend disclosed

- **WHEN** 运行已经开始
- **THEN** 运行视图以只读文本显示本次实际使用的执行后端

### Requirement: Return and resume

用户 MUST 能在任意阶段返回货架而不中断正在执行的运行。存在进行中的运行时，货架 MUST 提供可见的返回该运行的入口。重启应用后 MUST 能恢复到进行中运行的运行视图。

#### Scenario: Leave without cancelling

- **WHEN** 用户在执行中阶段返回货架
- **THEN** 运行继续执行，货架上显示进行中运行的数量与返回入口

#### Scenario: Resume after restart

- **WHEN** 用户在有进行中运行时重启应用并进入工作台
- **THEN** 系统恢复到该运行的运行视图，或在货架上明确提供恢复入口

### Requirement: Honest empty state

当货架没有可运行工作流时，系统 MUST 说明原因并给出补齐入口，MUST NOT 使用占位卡片、示例卡片或目标输入框掩饰无货状态。

#### Scenario: Nothing runnable

- **WHEN** 货架上没有任何可运行的工作流
- **THEN** 系统显示当前可用数量为零，逐条列出原因（如 Daemon 未连接、未安装所需 Agent、未激活仓库）并为每条原因提供直接的补齐操作

#### Scenario: Partially stocked shelf

- **WHEN** 货架上有部分可运行工作流，同时存在因未连接能力而缺失的工作流
- **THEN** 系统在展示可运行工作流的同时，明确告知连接何种能力可解锁更多工作流

### Requirement: Operation cost budget

货架与运行视图 MUST 在单屏内完成主任务，关键信息 MUST NOT 藏在折叠区或次级 Tab 中。从进入货架到运行开始 MUST NOT 超过两步用户操作（选择卡片主操作、确认输入）。

#### Scenario: Two steps to running

- **WHEN** 用户看到一个可运行的工作流卡片
- **THEN** 点击主操作并确认输入后运行即开始，中间不插入模式选择、后端选择或路径选择步骤

#### Scenario: No collapsed essentials

- **WHEN** 用户处于货架或运行视图
- **THEN** 判断可运行性、所需输入与当前进度所必需的信息均直接可见，不需要展开折叠区才能获取
