# 开发自测 — split-workbench-into-workflow-and-manage-tabs

## 改动

- `src/workspace.html` — 顶栏新增 `#wbModeTabs`（工作流 / 管理）；移除 `#wbManageToggle` / `#wbManageMenu` / `#wbManageClose` / `#wbShelfNewWorkflow`；`#wbManageDrawer` → `#wbManageSurface`（`.wb-surface`）；新增 `#wbWorkflowManagePage` 分区（新建入口 + 我的工作流列表 + 空态）
- `src/workbench.js` — `setSurface` 支持 `manage`；新增 `syncModeTabs()`（Tab 显隐/选中、搜索框按 Tab 显隐）；`MANAGE_PANELS` 新增 `workflows` 并作默认分区；新增 `renderWorkflowManage()` / `deletePersonalWorkflow()` / `handleWorkflowManageAction()`；退役 `closeManageDrawer`
- `src/workbench-shelf.css` — 管理由 fixed 抽屉改为 surface；新增工作流管理列表与空态样式；删除 `.wb-shelf-new-workflow`
- `src/workbench-layout.css` — 自动化独立模式改指 `#wbManageSurface`，并在该模式隐藏一级/二级 Tab
- `tests/workbench-templates.test.js` — 两 Tab / 管理常驻面 / 工作流分区断言

## 验证

| 项 | 结果 |
|---|---|
| `npm test` | 1574/1574 通过（连续两轮） |
| `npm run lint` | lint ok · script-scope ok |
| `npx openspec validate split-workbench-into-workflow-and-manage-tabs --strict` | 通过 |
| Electron 冒烟 `evidence/workbench-tabs-electron-smoke.js` | 22/22 · 控制台错误 0 |

冒烟覆盖：两 Tab 存在且默认工作流、无管理下拉、筛选行无新建按钮、管理为常驻面（`position` 非 fixed）、三分区顺序 `workflows,daemon,automation`、默认工作流分区、搜索按 Tab 显隐且搜索词保留、外部跳转直达自动化分区、编排页隐藏 Tab 并可恢复、窄窗(760px)无横向溢出。

## 截图

![工作流 Tab](screenshots/workbench-tab-workflow.png)

![管理 Tab · 工作流分区](screenshots/workbench-tab-manage-workflows.png)

![管理 Tab · 自动化分区](screenshots/workbench-tab-manage-daemon.png)

![窄窗 760px](screenshots/workbench-tab-manage-narrow.png)

## 已知遗留

- 首轮 `npm test` 曾出现 3 个知识网相关失败（`knowledge-governance-onboarding` / `knowledge-page-refactor` / `single-root-knowledge-top-level-naming`），复跑两轮均全绿，且这些用例只读 `src/workspace.js`，不在本次改动范围内。
- `.wb-manage-panel .wb-studio-shell` 两栏压缩规则为编排曾嵌在抽屉时期的遗留选择器，本次未清理（另有测试断言依赖）。
