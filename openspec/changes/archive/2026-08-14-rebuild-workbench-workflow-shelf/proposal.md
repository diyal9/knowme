## Why

工作台经过至少 6 轮改版（目标驱动、模式化、双路径统一、导航壳打磨…），每一轮都在旧地基上加盖、从未拆过违建。当前结果是用户直接判定的「乱七八糟」：

- **同一个「开始一项工作」的意图有 7 个入口**：首页目标框、顶栏「开始一项工作」按钮、Launch Drawer 内的完整目标流、Flow Library 卡片、任务页旧工作流浏览器、助理首页快捷卡、右下角悬浮球。用户不知道该点哪个，点不同入口得到的还不是同一套流程。
- **五个 Tab 表达三套互相打架的主张**：`redesign-goal-driven-workbench`（目标优先、三 Tab）、`refine-workbench-guidance-and-header`（强化模式控件）、`unify-workbench-pipelines-and-agent-studio`（双路径、四 Tab）三个 change 的产物同时留在界面上，谁也没赢。
- **命名对不上实体**：Tab 写「工作流」点进去是 Agent 编排 Studio；Tab 写「智能体管理」容器 id 却是 `wbTeamPage`、page 值是 `agents`。
- **僵尸代码仍在运行**：`workbench.js` 7200 行里 `renderTeam()`、`setWorkbenchContentPage()`、`#wbTabTeam`/`#wbTabFlows` 的绑定逻辑仍在执行，但对应 DOM 早已删除；HTML 里 `#wbFlowsPage`、`#wbWorkflowBrowser`、`#wbWorkflowSections` 三个 `wb-legacy-hidden` 空壳仍在渲染树里。

### 更深的病因：货架本身是空的

对工作流存量做全链路盘点后，发现界面混乱只是表症。真实存量如下：

- 货架数据源 `workflowPackages` **总共只有 5 条**：3 条代码内置的垂直管线种子（`workbench-console-model.js` 的 `VERTICAL_PIPELINE_SEEDS`）+ 2 条从激活 Git 仓库 `.cursor/workflows/` 投影的条目。
- **默认领域筛选为 `office`**，一进工作台就再砍掉 `engineering-delivery` 与 `visual-brief-to-export`，货架只剩 3 张卡。
- **仓库工作流在投影时丢失 graph**：`team-run`（JSON 内有 6 节点）与 `game-dev-delivery`（2 节点）投影成 package 后 `graph.nodes = 0`、`agentRefs = []`，`validateWorkflowPackage` 直接判 `missing_graph`。有名无实。
- **3 条垂直管线本就没有 graph**，它们不是可执行工作流，而是「一键打开 Agent Graph」的入口伪装成了工作流卡片。
- **Agent 引用悬空**：`office-meeting-to-actions` 引用不存在的 `office-assistant`（实际靠 `office-partner` 别名兜底）；`visual-brief-to-export` 引用的 `copywriter` / `designer` 均不存在，因此近乎永远 `unavailable`。
- **Daemon 在线时的 ~14 条真实可跑工作流根本不进货架**，只出现在被隐藏的「运行」Tab 里。
- **deprecated 未在货架过滤**：`game-dev-delivery` 已被 Daemon API 与 Tasks 页过滤，货架仍然展示。

结论：**在最常见配置（Daemon 未启动、未安装 Expert、默认办公域）下，货架上真实能端到端跑通的工作流为 0 条。**

这解释了此前所有改版为何都收敛不了——货架没货，于是补一个目标输入框让用户描述需求；描述完还是没货，于是补推荐、补 Launch Drawer、补快捷卡、补悬浮球。**七个入口和五个 Tab 的本质，是在给一个空货架做门面。** 只重做 UI 只会得到一个干净的空货架。

关键判断：**信息架构没有主线是表症，货架无货是病根，两者必须一次解决**。用户已明确选定主线为「工作流货架」——挑一个现成流程 → 填参数 → 跑 → 看产物——并授权推倒重来。用户同时明确反馈：管理类功能的**划分**没问题，问题是**每个界面本身太复杂、操作不方便**。

时机成立的原因：底层 `workflow-package` 数据模型（`name` / `description` / `inputs[]` / `outputs[]` / `agentRefs` / `executionBackends` / `source` / `status`）已经具备货架卡片所需的全部字段，货架无货是投影与接入的缺陷，不是模型缺陷。这是修复成本最低的时点。

### 目标用户

- **主要**：把 KnowMe 当生产力工具的个人知识工作者。他打开工作台的心智是「我有一件事要办完」，不是「我要配置一套 Agent 系统」。
- **次要**：愿意改造流程的进阶用户。他需要「复制官方流程为我的版本」和编排 Studio，但这些不该挡在主路径上。
- **明确不服务**：把工作台当运维控制台看 Daemon 健康度的角色。该视角降级为管理区。

## What Changes

### 第一优先：先让货架有货（供给侧）

界面改造之前必须先解决无货问题，否则只是把空货架擦干净。

- **修复仓库工作流投影丢 graph**：`projectWorkflowPackages()` 投影 `.cursor/workflows/*.json` 时须携带 `graph.nodes` 与 `agentRefs`，让 `team-run`（6 节点）与 `game-dev-delivery`（2 节点）成为真正可校验、可执行的 package，而非空壳。
- **把 Daemon catalog 接入货架**：Daemon 在线时其 ~14 条工作流须与本地流程同列于货架，不再只存在于隐藏的运行页。Daemon 离线时这些条目消失，货架如实反映当前可用集合，不做假装。
- **修复悬空 Agent 引用**：`office-assistant` 归一到实际存在的 `office-partner`；`visual-brief-to-export` 因 `copywriter` / `designer` 不存在，须明确标记为未就绪并给出「缺什么」，不再以可用姿态占位。
- **货架过滤 deprecated**：与 Daemon API 和运行页保持一致，`catalog.visibility` 为 `deprecated` / `internal` 的条目不上货架。
- **移除默认领域预筛**：进入货架默认展示全部，领域是用户主动收窄的手段，不是默认藏货的机制。
- **诚实的空状态**：当货架确实无货可上时，明确告知缺什么（未连接 Daemon / 未安装 Agent / 未激活仓库）并给出一步到位的补齐入口，而不是用目标输入框掩饰。

### 主线：工作台收敛为「货架 → 运行」两态

- **新增货架视图（Shelf）** 作为工作台唯一默认落地页。卡片直接回答用户的三个问题：这个流程**能给我什么**（`outputs` / `description`）、**要我提供什么**（`inputs`）、**现在能不能跑**（`status` + `executionBackends` 可达性）。支持按领域、来源（官方 / 我的）筛选与关键词搜索。
- **新增运行视图（Run）** 作为从货架卡片进入的接管式三段流程：`确认输入 → 执行中 → 产物`。三段有明确进度指示与返回货架的退路。「确认输入」由 `inputs[]` 自动生成表单，并在启动前展示将参与的 Agent 与实际执行后端。
- **BREAKING｜启动入口从 7 个收敛为 1 个**：货架卡片的「使用」是唯一启动路径。移除 `#wbLaunchDrawer` 独立启动抽屉、顶栏「开始一项工作」按钮、首页目标输入框的独立启动语义（降级为货架搜索/筛选）。助理侧的快捷卡与悬浮球改为**跳转到货架并预填筛选条件**，不再自带一套启动流程。

### 减法：删除违建

- **BREAKING｜移除五 Tab 结构**。`开始工作 / 工作流 / 智能体管理 / Daemon 模式 / 运行` 五个 Tab 全部撤销，工作台一级不再有 Tab。
- **管理类功能降级为次级入口**（货架页右上「管理」），互不平级竞争注意力：智能体管理、编排 Studio、执行后端与 Daemon 状态、自动化。
- **删除死代码与僵尸 DOM**：`renderTeam()`、`renderTeamAssets()`、`setWorkbenchContentPage()` 及 `activeContentPage` 状态、`#wbTabTeam`/`#wbTabFlows`/`#wbTeamPageTitle` 等无 DOM 绑定的查询；`#wbFlowsPage`、`#wbWorkflowBrowser`、`#wbWorkflowSections`、`#wbConsolePipelines`、`#wbModeSelect` 兼容 select 等隐藏空壳。
- **统一命名**：对外一律用「工作流」指代可执行的 workflow package，「智能体」指代 agent，「编排」指代 Studio。代码侧 `team` / `flows` / `pipelines` 三套历史别名收敛到 `agents` / `workflows`，删除 `setWorkbenchPage` 里的别名映射分支。

### 操作成本：每个界面都要更浅

用户明确反馈管理类功能的划分没问题，问题是界面太复杂、操作不方便。因此除 IA 收敛外，每个保留下来的界面都须满足：

- **单屏可完成主任务**，不靠折叠区、`details` 展开或三级 Tab 藏必要信息。删除 `wb-start-readiness`、`wb-studio-saved` 等把关键信息埋进折叠层的做法。
- **从进入到启动不超过 2 步**：看到卡片 → 点「使用」→ 确认输入 → 跑。中间不插入模式选择、后端选择或路径选择。
- **执行后端由系统判定，不问用户**。`local-team` / `daemon` 的选择依据可达性自动决定，仅在运行视图内以只读方式告知实际用了哪个。
- **管理区每个面板不超过两栏**。现有 Studio 与 Daemon 页均为三栏（库 + 画布 + 检查器），须压缩为两栏或抽屉式。

### 治理：终结 change 打架

- 归档或显式标记为被本 change 取代的冲突 change：`redesign-goal-driven-workbench`、`refine-workbench-guidance-and-header`、`polish-workbench-team-empty-state`（针对已删除的 `#wbTeamList`）、`polish-workbench-navigation-shell`。
- `unify-workbench-pipelines-and-agent-studio` 中仍成立的底层约定（Workflow Package 为真源、Daemon 降级为执行后端）由本 change 继承并重述，其 UI 层主张作废。

### 非目标（Non-goals）

- **不动执行内核的行为**。`workbench-launch-controller`、`workbench-agent-graph`、Team Runtime 的执行语义不变。供给侧修复只涉及**数据投影与目录接入**（`projectWorkflowPackages()`、Daemon catalog 合并、Agent 引用归一），不改变工作流实际怎么跑。
- **不改 `workflow-package` 数据模型**。货架完全基于现有字段渲染；投影修复是把已有字段填对，不扩展 schema。
- **不新写工作流内容**。本次只把已存在但没接进来、或接进来时丢了内容的工作流修好，不新增业务流程；`visual-brief-to-export` 缺失的 Agent 不在本次补齐，如实标记未就绪即可。
- **不做工作流市场 / 云端同步 / 分享**。货架只呈现本地已有与 Daemon 提供的流程。
- **不重做助理对话区（`#agentCol`）**。仅调整它与货架之间的跳转契约。
- **不做付费与商业化环节**。本次是可用性止血，商业化路径待货架跑通后另议。

## Capabilities

### New Capabilities

- `workbench-workflow-shelf`: 工作台货架视图与「确认输入 → 执行中 → 产物」运行三段式的完整行为契约，含卡片信息结构、可达性标注、筛选搜索、唯一启动入口、返回与恢复语义。
- `workflow-supply`: 货架供给契约——工作流从仓库、Daemon catalog、个人存储汇入货架的完整性要求（graph 与 agentRefs 不得在投影中丢失）、deprecated 过滤、Agent 引用归一、以及无货时的诚实空状态要求。

### Modified Capabilities

- `agent-workbench`: 移除多 Tab 一级导航要求，改为「货架 / 运行」两态 + 管理次级入口；修正已与实现脱节的 Rail 入口标识；移除描述旧「上下分区」布局的三条失效要求。
- `workbench-flow-library`: Flow Library 由首页内的一个区块升格为工作台主视图本身，卡片自身承载启动决策；移除默认领域预筛；移除「输入目标 → 推荐 → 启动」这条与卡片并行的启动路径。
- `agent-composition-studio`: 编排 Studio 从一级 Tab 降级为管理区次级入口，常驻布局压缩为两栏；明确其产物直接进入货架的「我的工作流」。

> 投影完整性（graph 与 agentRefs 不得丢失）归入新能力 `workflow-supply`，不单独修改 `workflow-package` 规格——后者定义的是 Package 结构本身，投影是供给侧行为。
> Rail 一级导航维持现状：用户已确认智能体 / 编排 / Daemon / 自动化的**功能划分没有问题**，问题在于各面板内部过于复杂，因此本次不改 `workspace` 规格。

## Impact

**受影响代码 — 供给侧**

- `src/main.js`：`projectWorkflowPackages()`（约 3434–3484 行）投影须携带 graph 与 agentRefs；Daemon catalog 合并进货架数据源；dedupe 策略调整。
- `src/lib/workbench-console-model.js`：`VERTICAL_PIPELINE_SEEDS` 的 Agent 引用归一（`office-assistant` → `office-partner`）；`resolveVerticalPipeline()` 的 readiness 判定不再作为货架默认隐藏依据。
- `src/lib/workbench-daemon-client.js`：catalog 输出供货架消费，deprecated / internal 过滤规则复用。

**受影响代码 — 界面侧**

- `src/workspace.html`：`#workbench` 整段（约 2988–3305 行）重写；`#wbLaunchDrawer` 及相关弹层移除或改造。
- `src/workbench.js`：约 7200 行，主控制器重构；预期净减少代码量。删除 Tab 路由、死渲染函数与旧启动路径。
- `src/workbench-layout.css`、`src/workbench-console.css`：货架网格与运行三段式样式重写，删除失效选择器。
- `src/workspace.js`：Rail 导航与 `openWorkbenchHome()` 契约调整。
- `src/workspace-agent.js`：助理快捷卡改为跳转货架，移除自带启动流程。

**不受影响**

- `workbench-launch-controller` / `workbench-agent-graph` / Team Runtime 的执行语义、`workflow-package` schema 定义、`src/preload.js` 暴露的 API 面。

**风险**

- 重写主控制器会打断既有 Electron 冒烟测试对 DOM id 的断言，需同步更新测试选择器。
- 五个 Tab 承载的功能需确认全部在新架构中有归宿，不能因收敛而丢失能力；tasks 阶段须逐项做归宿映射表。
- 供给侧修复后货架条目数会上升，但 Daemon 离线时仍会明显变少。空状态的诚实度是本次成败关键：宁可显示「当前只有 2 个可用，连接 X 可解锁更多」，也不要用占位卡片填充。
- 投影携带 graph 后 package 体积增大，需确认 `workbench-workflows.json` 与 IPC 传输无性能问题。
