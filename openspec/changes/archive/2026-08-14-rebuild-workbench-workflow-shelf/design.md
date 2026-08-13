## Context

见 `proposal.md` 的 Why。此处只记录影响技术方案的现状约束。

**供给链路现状**（`src/main.js` `projectWorkflowPackages()`，3434–3485 行）：四路来源顺序合并进一个 `packages[]`，靠 `seen: Set<id>` 去重，先到先得。

| 顺序 | 来源 | 当前构造方式 | 缺陷 |
|---|---|---|---|
| 1 | 仓库 `.cursor/workflows/index.json` | 只取 index 条目的 `id/name/description/tags/path` 造 package | **不读 JSON 正文**，`graph.nodes = []`、`agentRefs = []` |
| 2 | Daemon catalog | 只取 `id/name/description/tags` | 丢弃 `agentIds`，同样无 graph |
| 3 | 个人存储 | 原样放入 | 完整 |
| 4 | 垂直管线种子 | `resolveVerticalPipelines(facts)` | 本就无 graph，仅有 `agentRefs` |

去重靠 `seen` 先到先得，仓库条目排在 Daemon 之前，因此**同 id 时保留的恰好是内容更空的那一份**。

**渲染侧现状**：`activeWorkflowPackages()`（`src/workbench.js` 1777–1788）在文本搜索之后套一层 `consoleDomainOf(item) === consoleDomain`，而 `consoleDomain` 默认 `'office'`。`renderFlowLibrary()` 的 `canRun` 取**领域级** readiness 而非单条工作流的依赖判定。

**进程边界**：货架数据全部在主进程组装，经 `workbench-load` 一次性投影给渲染进程；渲染进程只做展示与筛选，不再自行拼装可运行性。这条边界本次保持不变。

**既有可复用件**：`workbenchModel.parseWorkflow()` 解析工作流 JSON，`workbenchModel.buildWorkflowGraph()` 从 `entry_node` BFS 产出 `{ order, edges, byId }`。仓库工作流的 graph 修复可直接复用这两者，无需新写解析器。

## Goals / Non-Goals

**Goals:**

- 供给汇聚成为一条**可诊断**的管道：每个条目能说出自己来自哪、为什么上架或为什么被排除。
- 可运行性判定从渲染进程上移到主进程，成为 package 上的一个**既成事实字段**，渲染进程不再各自推断。
- 工作台渲染层从「Tab 路由 + 多页面」降为「两态状态机」，删除的代码量应显著大于新增。

**Non-Goals:**

- 不引入前端框架或构建步骤，维持原生 HTML/JS。
- 不改 `workbench-load` 的 IPC 通道数量与调用时机，只改其载荷内容。
- 不重写 `workbench-launch-controller` 的路由决策，只减少调用它的入口数量。

## Decisions

### D1：可运行性在主进程算好，随 package 下发

新增 `readiness` 字段随每个 package 下发：`{ runnable: boolean, blockers: [{ code, label, fixAction }] }`。

**为什么**：当前渲染进程用领域 readiness 近似单条工作流的可运行性，这是「点了没反应」和「明明能跑却显示需要准备」两类问题的共同根因。只有主进程同时掌握 Daemon 在线状态、本地 Expert 清单、仓库激活状态与 package 内容，能做出唯一正确的判定。

**否决的替代方案**：在渲染进程补齐判定逻辑。会导致主/渲染两处各存一份规则，且渲染进程拿不到 Expert 安装状态的完整视图。

`blockers[].fixAction` 是一个结构化意图（如 `{ kind: 'connect-daemon' }`、`{ kind: 'install-expert', expertId }`），渲染进程据此渲染按钮，不下发文案以外的行为逻辑。

### D2：供给管道改为「先收集、后择优、再排除」三段

替换现有的顺序 `seen` 去重：

1. **收集**：四路来源各自产出候选，标注 `origin`。仓库来源此时读取 JSON 正文，经 `parseWorkflow` + `buildWorkflowGraph` 填充 `graph.nodes` / `graph.edges`；节点上的 `agent` 字段汇总去重后填 `agentRefs`。
2. **择优**：按 id 分组，同 id 保留**可执行内容最完整**的一份（先比 `graph.nodes.length`，再比 `agentRefs.length`，仍相同则按 `origin` 优先级 personal > repo > daemon > seed）。这修正了当前「先到先得反而留下空壳」的缺陷。
3. **排除**：套用排除规则（deprecated / internal 可见性、既无 graph 又无 agentRefs 的空壳、无法解析的 Agent 引用），每次排除记入 `diagnostics[]`。

产出 `{ packages, diagnostics }`。`diagnostics` 直接喂给货架空状态，满足 `workflow-supply` 的 Supply diagnostics 要求。

**否决的替代方案**：只修仓库分支的 graph 丢失。这能让 2 条仓库工作流复活，但留着「先到先得」的择优缺陷和无诊断能力，空状态依然只能说「暂无内容」。

### D3：Agent 引用归一放在供给层，用显式别名表

`office-assistant → office-partner` 这类历史别名在供给层归一，维护一张显式别名表而非模糊匹配。

**为什么**：别名归一若放在渲染层或 readiness 计算内部，会出现「卡片说可用、启动时却找不到 Agent」的不一致。放在供给层意味着下发的 `agentRefs` 已经是实际存在的标识，后续所有环节看到的是同一个事实。

**代价**：别名表是硬编码维护项。接受，因为它同时是一份「哪些引用曾经错过」的可见清单，比散落的兜底逻辑更容易清理。`visual-brief-to-export` 引用的 `copywriter` / `designer` 不进别名表——它们不是别名，是真的不存在，按 D1 记为 blocker。

### D4：渲染层改为两态状态机，Tab 路由整体删除

`setWorkbenchPage(page)` 及其 `flows→home`、`team→agents` 别名映射、`activeContentPage` / `setWorkbenchContentPage()` 三级 Tab 机制全部删除，替换为 `surface: 'shelf' | 'run'` 单一状态。管理面板改为覆盖在货架之上的抽屉，不参与 `surface` 状态，关闭即回到货架，因此不需要额外的返回栈。

**为什么用抽屉而非独立态**：管理是低频旁路操作，做成第三个状态就得处理「从运行态进管理再返回哪里」的问题，这正是当前多 Tab 相互跳转产生混乱的机制。抽屉天然只有一个返回目标。

### D5：`workbench.js` 按视图拆分，但不引入模块加载器

7200 行的单文件按职责拆为 `workbench-shelf.js`、`workbench-run.js`、`workbench-manage.js` 三个脚本，与现有 `workbench.js` 一样以传统 `<script>` 顺序加载并挂载到全局命名空间。

**为什么不上 ES module**：渲染进程当前无构建步骤，改模块化会牵动 CSP、preload 与所有既有脚本的加载方式，属于与本次目标无关的风险。拆文件已能解决可维护性，模块化留待独立 change。

**取舍**：全局命名空间仍有污染风险，通过统一前缀 `WorkbenchShelf` / `WorkbenchRun` / `WorkbenchManage` 与 lint 的 script scope 检查约束。

### D6：领域筛选保留但不预设

`consoleDomain` 初始值从 `'office'` 改为 `'all'`，且不持久化"上次选择的领域"。

**为什么不持久化**：领域筛选被记住是当前"进来就少两张卡且不知道为什么"的直接原因。筛选是一次性收窄动作，下次进入应回到全集。滚动位置与进行中运行仍然持久化，二者性质不同。

## Risks / Trade-offs

**[仓库工作流 JSON 在主进程同步读盘，拖慢 `workbench-load`]** → 仓库工作流数量为个位数，单文件在 KB 量级，同步读取代价可忽略。若 index 条目数超过 32 则截断并记入 diagnostics，避免异常仓库拖垮启动。

**[package 携带 graph 后体积增大，IPC 载荷与 `workbench-workflows.json` 变大]** → 仅个人工作流会落盘，仓库与 Daemon 来源每次重新投影不持久化。IPC 单次载荷预计增加数十 KB，在 Electron IPC 的可接受范围内。若实测超过 1 MB 则改为货架只下发 `nodeCount`，进入运行视图时再按需拉取完整 graph。

**[Daemon 在线/离线导致货架条目数跳变，用户误以为工作流丢失]** → 由 `workflow-supply` 的 Daemon offline removes its workflows 场景约束：离线时明确告知「连接 Daemon 可恢复 N 个工作流」，而非静默消失。

**[删除多入口后，习惯从悬浮球或助理快捷卡启动的用户找不到入口]** → 这些入口保留，但改为跳转货架并预填筛选。用户点击后仍会到达可启动的位置，只是多了一次确认。这是刻意的取舍：确定性优先于点击数。

**[重写渲染层打断既有 Electron 冒烟测试的 DOM id 断言]** → 在 tasks 中先建立「五 Tab 功能归宿映射表」，逐项确认新 DOM 中的对应元素，再同步更新测试选择器。测试更新与实现同批提交，不允许先删断言后补。

**[规格删除了三条 `agent-workbench` 旧要求，可能误删仍在使用的行为]** → 三条要求描述的 DOM（上半助手区、下半事项区、外部目录 Agent 加载）已确认不存在于当前 `workspace.html`，删除的是已死规格而非活行为。tasks 阶段以 DOM 检索复核一次。

## Migration Plan

无数据迁移。`workbench-workflows.json`（个人工作流）格式不变，旧文件可直接读取。

界面为一次性替换，不做灰度：工作台是单一入口的本地功能，并存两套 UI 只会重演当前的多入口问题。

**回滚策略**：本次改动集中在渲染层三个新脚本、`workspace.html` 的 `#workbench` 段、以及 `main.js` 的供给函数。若需回滚，还原这几处即可，主进程执行链路与 IPC 契约未被改动，不存在需要反向迁移的持久化状态。
