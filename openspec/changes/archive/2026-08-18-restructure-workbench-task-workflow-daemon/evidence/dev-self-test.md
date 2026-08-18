# Dev Self-Test — restructure-workbench-task-workflow-daemon

日期：2026-08-11

## 硬门禁

| 项 | 命令 | 结果 |
|---|---|---|
| Lint | `npm run lint` | ✅ lint ok / script-scope ok |
| 单元/集成测试 | `npm test` | ✅ tests 1585 / pass 1585 / fail 0 |
| Story 门禁 | `node .cursor/scripts/harness.js gate --json` | ✅ 硬项通过（advisory 均为其它历史 change 缺 qa-plan/code-review，与本次无关） |

## 自测记录

- 术语替换：`agent-identity.js` 身份标签、`workbench.js` 用户可见 Agent 角色名词、`workspace.html` studio/run 文案、`workspace-agent.js`/`workflow-supply.js`/`workbench-studio-model.js`/`editor-pane.html`、能力中心表单占位符统一为「专家」；保留 `Agent Graph`/`Agent Run` 系统名与代码标识符。
- 三 Tab：`#wbModeTabs` → 任务/工作流/Daemon；`setSurface` 新增 `taskhome`；`syncModeTabs`/`setWorkbenchPage`/`openManagePanel` 路由重构；默认着陆任务首页。
- task-store：新增 `src/lib/workbench-task-store.js` + `workbench-tasks.json`；`main.js` 新增 `workbench-task-list/create/update/archive` IPC；`preload.js` 暴露 API。
- 任务首页：`renderTaskHome`（快捷专家卡片 + 持久化最近任务）、`openTaskComposer`/`submitTaskComposer`/`openTaskFromRecent`（建任务 + 触发执行 + 回写状态）。
- 工作流 Tab：货架加「管理我的工作流」入口 → 管理子页可返回。
- Daemon Tab：`openManagePanel('daemon')` 提升为一等 Tab；修正轮询自动刷新判断。
- 测试断言更新：`tests/workbench-templates.test.js`（三 Tab + 调优专家）、`tests/workspace-agent.test.js`（懂你的专家搭档）。

## 待办（手动）

- [ ] `npm start` 本地 Electron 自测：三 Tab 互切、任务 composer 创建并执行、Daemon 面进入无控制台报错（GUI 环境需人工执行，补 screenshots）。
