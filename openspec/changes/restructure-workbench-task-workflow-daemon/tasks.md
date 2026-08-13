# Tasks

## 1. 术语统一为「专家」
- [x] 1.1 `agent-identity.js` 身份标签「团队/仓库/我的智能体 → 团队/仓库/我的专家」
- [x] 1.2 `workbench.js` 用户可见「Agent」角色名词 → 专家（保留 Agent Graph/Run 系统名）
- [x] 1.3 `workspace.html` studio/run 文案「Agent/智能体 → 专家」
- [x] 1.4 `workspace-agent.js`、`workflow-supply.js`、`workbench-studio-model.js`、`editor-pane.html` 文案统一
- [x] 1.5 能力中心专家表单占位符与引导措辞

## 2. 三 Tab 骨架
- [x] 2.1 `#wbModeTabs` 改为 任务/工作流/Daemon
- [x] 2.2 `setSurface` 支持 `taskhome`；新增任务 surface DOM
- [x] 2.3 `syncModeTabs` 三 Tab 高亮与显隐；搜索仅货架显示
- [x] 2.4 `setWorkbenchPage` 路由：home→taskhome、tasks→run、daemon→manage(daemon)
- [x] 2.5 `openManagePanel` 隐藏子 Tab、加返回按钮与标题
- [x] 2.6 默认着陆改为任务首页

## 3. 任务首页与 task-store
- [x] 3.1 `workbench-task-store.js` + `workbench-tasks.json` 数据模型
- [x] 3.2 `main.js` store 工厂 + `workbench-task-list/create/update/archive` IPC
- [x] 3.3 `preload.js` 暴露 task API
- [x] 3.4 `renderTaskHome`：快捷专家卡片 + 持久化最近任务列表
- [x] 3.5 `openTaskComposer` / `submitTaskComposer` / `openTaskFromRecent`：建任务并触发执行、回写状态
- [x] 3.6 任务首页样式（quick 卡片、recent 行、状态点、返回头）

## 4. 工作流 Tab
- [x] 4.1 货架加「管理我的工作流」入口 → 工作流管理子页（返回货架）

## 5. Daemon Tab
- [x] 5.1 daemon 提升为一等 Tab（openManagePanel('daemon')）
- [x] 5.2 修正轮询自动刷新判断（activeSurface==='manage' && activeManagePanel==='daemon'）

## 6. 门禁
- [x] 6.1 更新受影响测试断言（Tab 结构 / 术语）
- [x] 6.2 `npm run lint` 通过
- [x] 6.3 `npm test` 通过（1585/1585）
- [ ] 6.4 `npm start` 本地自测无控制台报错
- [ ] 6.5 harness gate 记录 evidence
