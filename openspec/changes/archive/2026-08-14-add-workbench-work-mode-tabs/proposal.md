> **本提案的 Tab 划分主张已被取代（superseded by `relocate-agent-authoring-to-capability-hub`）**
> 「团队管线 / 我的 Agent」两 Tab、个人工作流归 Agent Tab、我的 Agent Tab 混放工作流等主张作废。
> 工作台回到单一工作流货架（团队+我的混排、卡片打来源标签），Agent 的创建/编辑/调优迁至能力界面。
> 本提案中「今日待办下线」「移除来源 chip」的结论仍然有效并被新 change 继承。

## Why

上一轮 `rebuild-workbench-workflow-shelf` 把工作台收敛成单一「工作流货架」，解决了「货架无货 + 七入口五 Tab」的乱象。但货架只表达了**一种干活方式**：挑一个现成工作流跑。用户实际有两种心智：

- **用团队现成的**：直接用团队/官方提供的 Daemon 专业管线，挑一个跑，最省心。
- **用自己的 Agent**：选一个 Agent 直接使唤，或给它配 Skill 做点个性化调优，或把多个 Agent 编排成固定 DAG 沉淀成自己的工作流。

现在这两种方式被硬塞进同一个平铺货架，还叠了一排「官方 / 团队 / 我的」来源 chip 做区分——**来源筛选和用户心智里的「两类工作」其实是同一件事，却让用户在同一屏里选两次**。而「选 Agent 直接用 / 调优 / 编排」这条线在货架上根本没有落地面，只能钻进「管理」抽屉里找，与它作为「第二种干活方式」的地位不符。

同时首页顶部的「今日待办」是更早版本遗留的辅助区，与「挑流程 → 跑」的主线无关，只占据货架顶部视线。

### 目标用户

- **主要**：把 KnowMe 当生产力工具的个人知识工作者。他要么想「用团队给的现成流程赶紧把事办了」，要么想「用我自己调教过的 Agent 干活」，这两种意图应各有清晰入口。
- **次要**：愿意搭建个性化流程的进阶用户。他需要把「复制团队管线 / 编排多 Agent DAG」当作正经的第二条主路径，而不是藏在管理区的边角功能。

### 商业化与体验价值

把「团队提供」和「我自己的」升为顶部两条主路径，让新用户第一眼就能用团队沉淀的专业管线（低门槛、高成功率），又给进阶用户一条把 Agent 个性化沉淀成资产的成长路径——这正是「团队专业能力」与「个人 Agent 定制」两个付费方向的自然承载面。

## What Changes

- **新增工作台顶栏两 Tab**（工作模式切换）：`团队管线` 与 `我的 Agent`，与能力页 / 知识网一致地长在顶栏内部并左对齐，搜索、管理、进行中、刷新在同一顶栏右侧跨 Tab 共用。切换按**提供方**划分，不按执行后端划分——团队管线即便本地可跑也留在「团队管线」，不因 Daemon 掉线而在两个 Tab 间跳动。
- **`团队管线` Tab**：承载来源为官方（Daemon 直供）与团队（仓库 `.cursor/workflows/`）的工作流货架，保留领域筛选（办公 / 研发 / 视觉）。
- **`我的 Agent` Tab**：承载三块——我的本地 Agent（可直接开始使用，可进入调优）、我的工作流（personal / forked 的固定 DAG，可编辑）、以及「新建编排」入口通向 Studio。领域筛选在此 Tab 隐藏（本地 Agent 无领域维度）。首屏很可能只有本地 Agent，空态 MUST 提供「从团队管线复制一份」的显式入口而非让用户从零搭 DAG。
- **BREAKING｜移除「官方 / 团队 / 我的」来源 chip**：其分类语义升格为顶部两 Tab 的判据（official + team → 团队管线，personal + forked → 我的 Agent）。持久化的 `shelfSource` 字段退役，并对旧存档中的遗留值做兼容处理。
- **移除「今日待办」整条链**：货架顶部待办区块、悬浮助理「加入今日待办」菜单项、`knowme:add-todo` 事件监听。持久化 store（`workbench-todos.json`）与其 IPC 保留、不删用户数据，仅从 UI 摘除入口。
- **Agent 直接使用的路由（最小实现）**：`我的 Agent` Tab 上 Agent 卡片的主操作先路由到助理对话（复用现有 `startExpertChat`），不新建第二个对话场所；助理侧「我的专家」与本入口的关系待用户体验后再定。

### 验收标准

- 进入工作台，顶部出现「团队管线 / 我的 Agent」两个 Tab，默认停在「团队管线」，货架不再有「今日待办」区块，也不再有「官方 / 团队 / 我的」来源 chip。
- 「团队管线」Tab 只显示官方与团队来源的工作流，领域筛选可见且生效。
- 「我的 Agent」Tab 显示本地 Agent 卡片与个人工作流卡片，领域筛选不出现；当没有个人工作流时，空态给出「从团队管线复制一份」的可点击入口。
- 切到「我的 Agent」再切回「团队管线」，Daemon 在线/离线都不会让团队管线的条目在两个 Tab 间移动。
- 旧用户存档里遗留的 `shelfSource` 值不导致启动报错或货架空白。
- 悬浮助理菜单中不再有「加入今日待办」，且不存在点击无反应的死入口。

### 非目标（Non-goals）

- 不删除今日待办的持久化 store 与用户已存数据，只摘除 UI 入口。
- 不重做助理对话区，也不在本次解决「Agent 直接用」与助理「我的专家」的心智重叠（用户已明确选择「先不管，先把 Tab 和卡片做出来」）。
- 不改执行内核、不改 `workflow-package` schema、不改运行三段式（确认输入 → 执行中 → 产物）的既有行为。
- 不新增工作流内容，不做工作流市场 / 云端同步。

## Capabilities

### New Capabilities

- `workbench-work-modes`: 工作台顶部两条工作模式（团队管线 / 我的 Agent）的划分依据、各 Tab 的内容契约、通用 header、领域筛选按 Tab 显隐、我的 Agent 空态自造血、以及今日待办的下线要求。

### Modified Capabilities

- `workbench-workflow-shelf`（定义于未归档的 `rebuild-workbench-workflow-shelf`）：放宽「工作台一级 MUST NOT 提供 Tab 导航」这一条，改为允许且仅允许「团队管线 / 我的 Agent」两条工作模式 Tab；来源不再作为货架内的筛选 chip，而是上升为 Tab 判据。

## Impact

- `src/workspace.html`：`#wbShelfSurface` 内新增顶部 Tab 容器，移除 `#wbShelfTodos` 与来源 chip 组 `#wbSourceSwitcher`；悬浮助理菜单移除 `#km-fab-todo`。
- `src/workbench.js`：新增 `activeWorkMode` 状态与切换；`shelfItems()` 改按 Tab 过滤；领域筛选按 Tab 显隐；`我的 Agent` Tab 渲染本地 Agent 卡片；退役 `shelfSource` 并加存档兼容护栏；移除 `renderTodos` / `loadTodos` / `addTodo` 等待办链与 `knowme:add-todo` 监听。
- `src/workbench-shelf.css` / `src/workbench-layout.css`：Tab 样式；删除今日待办与来源 chip 的失效选择器。
- `tests/workbench-templates.test.js`、`openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-electron-smoke.js`：更新 DOM 断言。

**风险**

- `shelfSource` 是持久化字段且在恢复逻辑里有白名单校验；删除时若不处理旧存档遗留值，可能在 `restoreTaskRoomReturnState` 恢复时读到不存在的筛选态。须加兼容护栏（上次隐藏 modal 被状态恢复拉起来的教训）。
- `我的 Agent` Tab 首屏可能为空（个人工作流为 0），若空态不能自造血会显得像坏了。
