# 工作台重构为「任务 / 工作流 / Daemon」三 Tab + 术语统一为「专家」

## Why

上一轮 `split-workbench-into-workflow-and-manage-tabs` 把工作台收敛为「工作流 / 管理」两 Tab，但仍存在两个问题：

- **术语割裂**：产品同时用「智能体 / Agent / 专家」指代同一实体，用户理解成本高。产品定位是「KnowMe 规则下、具备统一规范的 Agent = 专家」，措辞应统一。
- **任务没有一等入口**：任务生命周期散落在头部「进行中」popover 与运行页，没有可持久回看的「任务」首页；「管理」是一个混合了工作流管理 / 执行后端 / 自动化的杂糅面，Daemon 作为外部执行后端也没有独立入口。

用户明确希望工作台以三条平级路径组织：**任务**（安排专家执行、持久化、首页展示）、**工作流**（官方或自建工作流的编排与长任务）、**Daemon**（接入外部专门管线、远程执行）。

### 目标用户

- **主要**：日常把具体活儿交给某位专家的用户——进工作台先看「任务」首页，选专家、下目标、回看进展。
- **次要**：用工作流编排长任务、或接入 Daemon 远程执行的进阶用户。

### 商业化与体验价值

三条平级路径让工作台的能力边界一眼可见；「任务」首页沉淀用户历史，形成回访钩子；Daemon 独立成 Tab 为后续「远程算力 / 订阅」留正经落点。

## What Changes

- **术语统一为「专家」**：工作台与助手侧用户可见文案里的「智能体 / Agent」角色名词统一为「专家」；保留 `Agent Graph` / `Agent Run` 等系统技术名与代码标识符（`agentId`、`agent-runs/`、IPC channel、CSS 类名）不变。
- **顶栏改为三 Tab**：`任务` / `工作流` / `Daemon`，默认停在「任务」。
  - `任务`（新增 surface `taskhome`）：快捷任务入口（按可用专家生成卡片）+ 持久化的最近任务列表（状态点 + 相对时间）。「新建任务 / 快捷卡片」打开 composer（选专家 + 目标），创建任务并触发执行；任务经独立 `workbench-tasks.json` 持久化。「自动化」作为任务面的次级入口。
  - `工作流`（surface `shelf`）：现有货架（官方 + 自建），新增「管理我的工作流」入口进入工作流管理子页（新建 / 我的列表 / 删除）。
  - `Daemon`（复用 manage surface 的 daemon 面板并提升为一等 Tab）：连接状态、只读专家阵容、远程任务监控与启动。
- **管理子 Tab 退役**：`#wbManageTabs` 隐藏；工作流管理与自动化改为从「工作流 / 任务」Tab 进入的单一用途子页，带「返回」入口；Daemon 由顶栏 Tab 直达。
- **新增 task-store 与 IPC**：`workbench-task-store.js` + `workbench-tasks.json`；`workbench-task-list/create/update/archive` IPC 与 preload API。

### 验收标准

- 进入工作台，顶栏出现「任务 / 工作流 / Daemon」三 Tab，默认停在「任务」。
- 「任务」首页展示快捷专家卡片与最近任务；无专家时给出去能力界面创建专家的提示。
- 新建任务 / 点快捷卡片打开 composer，选专家 + 填目标后创建任务并触发执行；任务持久化，重启后仍在最近任务列表。
- 「工作流」Tab 为货架，「管理我的工作流」进入工作流管理子页并可返回。
- 「Daemon」Tab 直达执行后端面（连接状态 / 只读专家阵容 / 任务监控）。
- 用户可见文案不再出现「智能体」；`Agent Graph` / `Agent Run` 等系统名保留。
- 旧存档不导致启动报错；`npm test`、`npm run lint` 通过。

### 非目标（Non-goals）

- 不做对话式（expert-manager）创建专家；专家创建 / 编辑仍在能力中心表单。
- 不改运行三段式、编排画布、Daemon 面板内部逻辑。
- 不新增工作流市场 / 云同步 / 远程算力计费。
- 不接线 `registerRemoteBackends()`（`/agent/v1/*` 远程执行后端仍待后续）。

## Capabilities

### Modified Capabilities

- `agent-workbench`：一级导航由「工作流 / 管理」两 Tab 改为「任务 / 工作流 / Daemon」三 Tab；新增任务首页与持久化 task-store；管理子 Tab 退役为单一用途子页；全局术语统一为「专家」。

## Impact

- `src/workspace.html`：`#wbModeTabs` 改三 Tab；新增 `#wbTaskSurface` 任务首页；管理头加返回按钮与标题、隐藏 `#wbManageTabs`；货架加「管理我的工作流」入口；studio/run 文案「Agent → 专家」。
- `src/workbench.js`：`setSurface` 支持 `taskhome`；`syncModeTabs` / `setWorkbenchPage` / `openManagePanel` 路由重构；新增 `renderTaskHome` / `openTaskComposer` / `openTaskFromRecent` 与 task IPC 调用；术语替换。
- `src/lib/workbench-task-store.js`（新增）+ `src/main.js`（store 工厂 + IPC）+ `src/preload.js`（API）。
- `src/lib/agent-identity.js`、`src/workspace-agent.js`、`src/lib/workflow-supply.js`、`src/lib/workbench-studio-model.js`、`src/capability-hub.js`、`src/editor-pane.html`：术语「智能体 → 专家」。
- `src/workbench-layout.css`：任务首页样式、管理返回头、货架管理入口。
- `tests/workbench-templates.test.js`、`tests/workspace-agent.test.js`：更新 Tab 与术语断言。

**风险**

- 术语替换须避免误伤代码标识符：仅改文案节点 / 常量文案，逐文件核对。
- 任务面 execRef 与底层执行（run / session / daemon）状态回写为乐观更新，尚未做全生命周期同步；重开任务以「重新按专家 + 目标启动」为主。
- `setWorkbenchPage('home')` 默认落点由货架改为任务首页，外部调用方需确认无副作用。
