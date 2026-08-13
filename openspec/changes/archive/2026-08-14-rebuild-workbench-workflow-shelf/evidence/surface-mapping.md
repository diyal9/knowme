# 功能归宿映射（删除前的落点确认）

删掉五个 Tab 之前，逐项确认能力落在哪里。确认依据是 `src/workspace.html` 的 DOM 与
`src/workbench.js` 的绑定，验证方式是 `shelf-electron-smoke.js` 的对应检查项。

| 原 Tab / 区块 | 承载能力 | 新落点 | 验证 |
|---|---|---|---|
| 开始工作 · 目标输入框 | 描述目标获取推荐 | 货架搜索框 `#wbShelfSearch`，仅筛选不启动 | `domain-filter-applies` |
| 开始工作 · Flow Library | 浏览与启动工作流 | 货架主体 `#wbShelfGrid` | `shelf-has-cards` |
| 开始工作 · 需要你处理 | 待处理运行 | 顶部「进行中」`#wbRunningToggle` → `#wbRunningPopover` | `running-toggle-visible-after-launch` |
| 开始工作 · 正在运行 | 运行中列表 | 同上 | 同上 |
| 开始工作 · 准备情况 | readiness 与能力缺口 | 卡片 blocker 标注 + 空状态诊断 | `shelf-summary-honest`、`empty-state-consistent` |
| 工作流（实为 Studio） | Agent Graph 编排 | 管理抽屉 · 编排 | `manage-panel-studio` |
| 智能体管理 | 本地 Agent 增删改 | 管理抽屉 · 智能体 | `manage-panel-agents` |
| Daemon 模式 | 模式选择 + 阵容 + 运行监控 | 管理抽屉 · 执行后端 | `manage-panel-daemon` |
| 运行 · 运行中心 | 运行列表 | 顶部「进行中」 | `running-toggle-visible-after-launch` |
| 运行 · 任务工作间 | 单次运行详情 | 运行视图 `#wbRunSurface` 三段式 | `run-leaves-input-stage` |
| 自动化（Rail 入口） | 定时任务 | 管理抽屉 · 自动化，Rail 入口保留 | `manage-panel-automation` |
| Launch Drawer | 目标 / 资源启动 | 撤销，能力并入货架卡片 + 运行视图确认输入 | `legacy-entries-removed` |
| 工作流启动弹窗 | 二次确认 + DAG 预览 + Daemon 上下文 | 撤销，确认输入是唯一确认点 | `no-blocking-mask-during-run` |

## `agent-workbench` 待删规格的 DOM 复核

`rg` 检索 `src/workspace.html` 确认以下元素已不存在，对应规格可安全移除：

- 上半助手区 / 下半事项区的双栏容器
- 外部目录 Agent 加载入口
- `#wbTabHome` `#wbTabFlows` `#wbTabTeam` `#wbTabTasks`
- `#wbFlowsPage` `#wbWorkflowBrowser` `#wbWorkflowSections` `#wbConsolePipelines` `#wbModeSelect`
- `#wbLaunchDrawer` `#wbConsoleNewRun` `#wbGoalForm` `#wbQuickGoalForm`
- `#wbRecentPanel` `#wbStartPanel` `.wb-work-task-room`
- `[data-wb-content-tab]` / `[data-wb-content-page]`

回归保护：`tests/workbench-templates.test.js` 对上述 id 有 `doesNotMatch` 断言；
`scripts/dead-dom-scan.js` 输出 `dead bindings 0`。
