## Purpose

在工作流货架之上，把工作台顶部分为两条工作模式：用团队现成的专业管线，或用自己的 Agent。两条模式各有清晰入口与内容契约，通用操作共用 header。今日待办作为遗留辅助区从工作台下线。

## ADDED Requirements

### Requirement: Two work-mode tabs partition the workbench

工作台 MUST 提供且仅提供两条工作模式 Tab：`团队管线` 与 `我的 Agent`。默认停在 `团队管线`。Tab MUST 位于工作台顶栏内部并左对齐，与能力页 / 知识网的顶栏 Tab 采用同一套视觉（Tab 占满顶栏高度，选中下划线压在顶栏底边），MUST NOT 在顶栏之下的内容区里另起一行。搜索、管理、进行中、刷新等通用控件 MUST 与 Tab 同处该顶栏并右对齐，跨 Tab 共用，MUST NOT 随 Tab 切换而重复出现或消失。

#### Scenario: Enter the workbench

- **WHEN** 用户从 Rail 进入工作台且没有正在恢复的运行
- **THEN** 顶栏左侧显示「团队管线 / 我的 Agent」两个 Tab，默认选中「团队管线」，同一顶栏右侧的搜索、管理、进行中、刷新可用

#### Scenario: Tabs live in the top bar

- **WHEN** 用户处于货架状态
- **THEN** 两个 Tab 渲染在工作台顶栏内，选中态下划线位于顶栏底边，内容区第一行是筛选与货架本身，而不是另一排 Tab

#### Scenario: Common controls persist across tabs

- **WHEN** 用户在两个 Tab 之间切换
- **THEN** 搜索框、管理入口、进行中入口、刷新按钮始终在顶栏同一位置，不重复渲染也不消失

#### Scenario: Run takeover hides the tabs

- **WHEN** 用户从货架启动一个工作流进入运行接管态
- **THEN** 顶栏不再显示工作模式 Tab，避免在接管态里提供货架的切换入口

### Requirement: Tabs split by provider, not by backend

两条 Tab MUST 按工作流的**提供方**划分：来源为官方（Daemon 直供）或团队（仓库）的归入 `团队管线`；来源为个人或派生（personal / forked）的归入 `我的 Agent`。MUST NOT 按执行后端划分。一个团队管线即便本地可执行，也 MUST 始终留在 `团队管线`，MUST NOT 因 Daemon 在线或离线而在两个 Tab 之间移动。

#### Scenario: Team pipeline stays put when daemon toggles

- **WHEN** 一个团队来源的工作流同时支持本地与 Daemon 后端，用户在 Daemon 在线与离线之间变化
- **THEN** 该工作流始终显示在「团队管线」Tab，不会移动到「我的 Agent」

#### Scenario: Personal workflow belongs to my agent tab

- **WHEN** 用户拥有一个个人或派生的工作流
- **THEN** 它出现在「我的 Agent」Tab，不出现在「团队管线」

### Requirement: Team pipeline tab keeps domain filter

`团队管线` Tab MUST 展示官方与团队来源的工作流货架，并 MUST 提供领域筛选（全部 / 办公 / 研发 / 视觉）。进入时领域 MUST 为「全部」，不预筛。

#### Scenario: Domain filter visible on team tab

- **WHEN** 用户处于「团队管线」Tab
- **THEN** 领域筛选可见且默认「全部」，选择某领域后货架按该领域收窄

### Requirement: My-agent tab hides domain filter

`我的 Agent` Tab MUST NOT 显示领域筛选（本地 Agent 与个人工作流没有可靠的领域维度）。切到该 Tab 时领域筛选控件 MUST 隐藏，切回 `团队管线` 时 MUST 恢复。

#### Scenario: Domain filter hidden on my-agent tab

- **WHEN** 用户从「团队管线」切到「我的 Agent」
- **THEN** 领域筛选整排隐藏；再切回「团队管线」时领域筛选重新出现且保持之前的选择

### Requirement: My-agent tab shows agents and personal workflows

`我的 Agent` Tab MUST 同时呈现两类内容：用户的本地 Agent（可编辑、非 Daemon）与用户的个人 / 派生工作流。本地 Agent 卡片 MUST 提供「开始使用」与「调优」两个操作。个人工作流卡片沿用货架卡片契约（开始 / 编辑）。

#### Scenario: Local agents are listed

- **WHEN** 用户处于「我的 Agent」Tab 且存在本地可编辑 Agent
- **THEN** 每个本地 Agent 显示为一张卡片，提供「开始使用」与「调优」操作

#### Scenario: Tune routes to the agent editor

- **WHEN** 用户点击某个 Agent 卡片的「调优」
- **THEN** 系统进入该 Agent 的编辑面板（智能体管理），定位到该 Agent

#### Scenario: Start routes to a conversation

- **WHEN** 用户点击某个 Agent 卡片的「开始使用」
- **THEN** 系统以该 Agent 开启一个助理对话，不新建第二个独立对话场所

### Requirement: My-agent empty state self-stocks

当 `我的 Agent` Tab 没有任何个人工作流时，空态 MUST 提供「从团队管线复制一份」的显式入口与「新建编排」入口，MUST NOT 要求用户从零手搭 DAG，也 MUST NOT 用占位卡片伪装有内容。

#### Scenario: No personal workflows yet

- **WHEN** 用户进入「我的 Agent」Tab 且个人工作流数量为零
- **THEN** 空态显示「从团队管线复制一份」和「新建编排」两个可点击入口，前者切到团队管线以便复制，后者进入编排 Studio

### Requirement: Source chips are removed

工作台 MUST NOT 再提供「官方 / 团队 / 我的」来源筛选 chip。其分类语义 MUST 由顶部两 Tab 承载。持久化的来源筛选状态 MUST 退役；恢复历史状态时遇到已退役的来源值 MUST 安全忽略，MUST NOT 导致货架空白或启动报错。

#### Scenario: No source chips on the shelf

- **WHEN** 用户处于任一 Tab
- **THEN** 页面上不存在「官方 / 团队 / 我的」来源筛选 chip

#### Scenario: Legacy source value is tolerated

- **WHEN** 应用从旧存档恢复且其中含有已退役的来源筛选值
- **THEN** 系统忽略该值、正常渲染货架，不抛错也不留空

### Requirement: Today-todo is retired from the workbench

工作台 MUST NOT 再展示「今日待办」区块，悬浮助理 MUST NOT 再提供「加入今日待办」入口，且 MUST NOT 存在任何指向已删除待办 UI 的死入口。待办的持久化数据与其 IPC MAY 保留以便将来复用，但 MUST NOT 在工作台 UI 出现。

#### Scenario: No todo block on the shelf

- **WHEN** 用户进入工作台
- **THEN** 货架上不存在「今日待办」区块

#### Scenario: No dead todo entry in the assistant

- **WHEN** 用户打开悬浮助理菜单
- **THEN** 菜单中不存在「加入今日待办」项，也不存在点击后无反应的相关入口
