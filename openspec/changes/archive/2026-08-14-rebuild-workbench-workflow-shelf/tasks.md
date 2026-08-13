## 0. 功能归宿映射（动代码前必须填完）

删除五个 Tab 之前，逐项确认每个能力在新架构中的落点。任何一行填不出落点，都不允许开始删除。
逐行确认与验证方式见 `evidence/surface-mapping.md`。

| 原 Tab / 区块 | 承载能力 | 新落点 | 状态 |
|---|---|---|---|
| 开始工作 · 目标输入框 | 描述目标获取推荐 | 货架搜索框（仅筛选，不启动） | [x] |
| 开始工作 · Flow Library | 浏览与启动工作流 | **货架主体** | [x] |
| 开始工作 · 需要你处理 | 待处理运行 | 货架顶部「进行中」入口 | [x] |
| 开始工作 · 正在运行 | 运行中列表 | 货架顶部「进行中」入口 | [x] |
| 开始工作 · 准备情况（折叠） | readiness 与能力缺口 | 卡片上的 blocker 标注 + 空状态诊断 | [x] |
| 工作流（实为 Studio） | Agent Graph 编排 | 管理抽屉 · 编排 | [x] |
| 智能体管理 | 本地 Agent 增删改 | 管理抽屉 · 智能体 | [x] |
| Daemon 模式 | 模式选择 + 只读阵容 + 运行监控 | 管理抽屉 · 执行后端 | [x] |
| 运行（隐藏 Tab） · 运行中心 | 运行列表 | 货架顶部「进行中」入口 | [x] |
| 运行（隐藏 Tab） · 任务工作间 | 单次运行详情 | **运行视图** | [x] |
| 自动化（Rail 入口） | 定时任务 | 管理抽屉 · 自动化（Rail 入口保留） | [x] |
| Launch Drawer | 目标/资源启动 | 撤销，能力并入货架卡片 | [x] |
| 工作流启动弹窗 | 二次确认 + DAG 预览 + Daemon 上下文表单 | 撤销，确认输入是唯一确认点 | [x] |

- [x] 0.1 逐行确认上表落点，并在 `evidence/surface-mapping.md` 记录确认依据
- [x] 0.2 用 DOM 检索复核 `agent-workbench` 待删的三条规格在 `workspace.html` 中确无对应元素

## 1. 供给侧：让货架有货

- [x] 1.1 在 `main.js` 供给层读取仓库工作流 JSON 正文，用 `parseWorkflow` + `buildWorkflowGraph` 填充 `graph.nodes` / `graph.edges`，节点 `agent` 字段去重后填 `agentRefs`
- [x] 1.2 Daemon catalog 条目补齐 `agentRefs`（来自 `agentIds`），保留其 catalog 可见性元数据供排除规则使用
- [x] 1.3 将顺序 `seen` 去重替换为「收集 → 择优 → 排除」三段管道，同 id 保留可执行内容最完整的一份
- [x] 1.4 建立 Agent 别名归一表并应用于全部来源（`office-assistant` → `office-partner`）
- [x] 1.5 实现排除规则：deprecated / internal 可见性、既无 graph 又无 agentRefs 的空壳、Agent 无法解析
- [x] 1.6 产出 `diagnostics[]`，记录每条排除的来源、id 与原因；随 `workbench-load` 下发
- [x] 1.7 为每个 package 计算 `readiness: { runnable, blockers[] }`，blocker 携带结构化 `fixAction`
- [x] 1.8 补供给层单元测试：graph 保留、择优优先级、别名归一、各条排除规则、诊断产出
- [x] 1.9 仓库 index 条目数超过 32 时截断并记入诊断

## 2. 货架视图

> 偏差说明：2.1 / 3.1 / 4.1 原计划拆出 `workbench-shelf.js` / `workbench-run.js` / `workbench-manage.js`。
> 实际改为「先把行为改对、把死代码删干净」：`workbench.js` 从 7200 行降到 5600 行、函数 241 → 218、
> 僵尸 DOM 绑定 0。渲染器拆分不改变任何用户可见行为，留待后续单独的重构 change，避免与本次行为
> 修复混在同一批提交里难以回归。CSS 已按计划拆出 `workbench-shelf.css`。

- [~] 2.1 货架渲染独立成 `renderShelf()` 及其辅助函数（未拆文件，见上方偏差说明）
- [x] 2.2 卡片信息结构：名称、一句话说明、产出摘要、所需输入摘要、来源标签、可运行状态；不展开即可读全
- [x] 2.3 不可运行卡片显示 blocker 与补齐操作，主操作禁用
- [x] 2.4 领域筛选默认 `all` 且不持久化；来源筛选（官方 / 团队 / 我的）；关键词搜索仅筛选不启动
- [x] 2.5 显示当前生效的筛选条件与一键清除
- [x] 2.6 顶部「进行中」入口，显示进行中运行数量并可返回运行视图
- [x] 2.7 诚实空状态：按 `diagnostics` 逐条列出原因与补齐操作，禁止占位卡片
- [x] 2.8 部分有货时提示「连接 X 可解锁 N 个工作流」
- [x] 2.9 卡片次级操作：复制并调整 / 编辑

## 3. 运行视图

- [~] 3.1 三段式接管布局与阶段进度指示（`setRunStage()`，未拆文件，见 2 节偏差说明）
- [x] 3.2 确认输入阶段：依据 `inputs[]` 生成表单，必填校验后方可执行
- [x] 3.3 确认输入阶段展示系统选定的执行后端（只读，不提供选择）
- [x] 3.4 执行中阶段：进度、追溯、执行节点、日志
- [x] 3.5 产物阶段：产出列表、打开、再跑一次
- [x] 3.6 任意阶段可返回货架且不中断运行
- [x] 3.7 重启后恢复到进行中运行的运行视图
- [x] 3.8 「开始运行」直接起跑，不再二次弹窗确认（`startWorkflowRun` / `beginLocalRun` / `beginDaemonRun`）

## 4. 管理抽屉

- [~] 4.1 覆盖货架的抽屉容器，关闭即回货架（未拆文件，见 2 节偏差说明）
- [x] 4.2 智能体面板迁入
- [x] 4.3 编排 Studio 迁入
- [x] 4.4 执行后端面板迁入（原 Daemon 模式）
- [x] 4.5 自动化面板迁入，Rail 入口保留并指向该面板
- [x] 4.6 抽屉内可直接切换四个分区，无需回到菜单
- [x] 4.7 编排保存后的工作流立即出现在货架「我的」来源，无需手动刷新

## 5. 清除违建

- [x] 5.1 删除 `#workbench` 的一级 Tab DOM 与 `wb-tabs` 相关样式
- [x] 5.2 删除僵尸 DOM：`#wbFlowsPage`、`#wbWorkflowBrowser`、`#wbWorkflowSections`、`#wbConsolePipelines`、`#wbModeSelect`
- [x] 5.3 删除 `#wbLaunchDrawer` 与顶栏「开始一项工作」按钮
- [x] 5.4 删除死代码：`renderTeam()`、`renderTeamAssets()`、`setWorkbenchContentPage()`、`activeContentPage` 等无绑定查询
- [x] 5.5 `setWorkbenchPage()` 收敛为 `setSurface()` 两态 + `openManagePanel()`
- [x] 5.6 助理快捷卡与悬浮球改为跳转货架并预填筛选
- [x] 5.7 统一命名：`workflowQuery` / `flowLibraryQuery` 收敛为 `shelfQuery` / `shelfSource`
- [x] 5.8 清理 `workbench-layout.css` / `workbench-console.css` 中的失效选择器（含把运行视图挤成两栏的 task-room grid）
- [x] 5.9 移除脚本引用上的 `?v=dual-track1` 版本标记
- [x] 5.10 删除旧的工作流启动弹窗及其 20 个专属渲染函数

## 6. 验证与证据

- [x] 6.1 同步更新 Electron 冒烟测试的 DOM 选择器，与实现同批提交
- [x] 6.2 `npm test` 全绿（1560 / 1560）
- [x] 6.3 `npm run lint` 无 error
- [x] 6.4 `npx openspec validate rebuild-workbench-workflow-shelf --strict` 通过
- [x] 6.5 Electron 实机自测：26 / 26，控制台零报错，货架 17 条 / 15 条可运行
- [x] 6.6 截图证据：货架（桌面 + 760px 窄窗）、运行确认输入、运行产物、管理抽屉
- [x] 6.7 记录改造前后的货架条目数与可运行数对比，存入 `evidence/shelf-supply-before-after.md`
- [x] 6.8 写 `evidence/dev-self-test.md`

## 7. 治理收尾

- [~] 7.1 归档被本 change 取代的冲突 change — 改为在 proposal 顶部加 superseded 标注。
  仓库里有 10 个工作台相关 change 已全部勾选但从未归档，属于既有积压；批量移动目录超出本次范围，
  待用户确认后统一归档。已标注：`launch-dialog-progressive-disclosure`（整体取代）、
  `align-workbench-workflow-catalog`（展示层取代，目录语义保留）
- [x] 7.2 在 `unify-workbench-pipelines-and-agent-studio` 中标注其 UI 层主张已被取代（资源模型层仍在服役）
- [x] 7.3 过 Story 完成门禁：`blocking: false`，本 change 的 advisory 清零（qa-plan Smoke Scope 已勾选化、code-review 已补）
