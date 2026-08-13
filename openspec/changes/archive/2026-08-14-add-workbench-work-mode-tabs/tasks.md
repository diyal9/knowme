## 1. 顶部两 Tab 与通用 header（DOM）

- [x] 1.1 在 `#wbShelfSurface` 内货架上方加入工作模式 Tab 容器（`团队管线` / `我的 Agent`），默认选中团队管线
- [x] 1.2 将搜索框、管理入口、进行中入口、刷新确认为 Tab 之上的通用 header，跨 Tab 共用
- [x] 1.3 移除来源 chip 组 `#wbSourceSwitcher` 及其 DOM
- [x] 1.4 移除今日待办区块 `#wbShelfTodos` 及其子节点
- [x] 1.5 移除悬浮助理菜单中的「加入今日待办」项 `#km-fab-todo`

## 2. Tab 状态与货架过滤（JS）

- [x] 2.1 新增 `activeWorkMode`（`team` / `mine`）状态与 `setWorkMode` 切换，切换时重渲染货架并同步 Tab 选中态
- [x] 2.2 `shelfItems()` 改为按 `workModeOf` 过滤（team → official+team，mine → personal+forked），不再消费 `shelfSource`
- [x] 2.3 领域筛选按 Tab 显隐：team 显示、mine 隐藏；切回 team 恢复既有领域选择
- [x] 2.4 退役 `shelfSource`：移除 chip 绑定与来源同步；在 `restoreTaskRoomReturnState` 忽略已退役来源值，改用 `workMode`
- [x] 2.5 更新货架汇总/清除筛选逻辑，去掉对 `shelfSource` 的引用

## 3. 我的 Agent Tab 内容（JS）

- [x] 3.1 mine Tab 渲染本地 Agent 卡片（`myAgents()`），每张卡片提供「开始使用」与「调优」
- [x] 3.2 「调优」路由到智能体管理面板并定位该 Agent（`openManagePanel('agents')` + `selectedManagedAgentId`）
- [x] 3.3 「开始使用」路由到助理对话（切 Rail + `startExpertChat`），不新建第二对话场所
- [x] 3.4 mine Tab 同时渲染个人/派生工作流卡片（沿用现有货架卡片：开始 / 编辑）
- [x] 3.5 mine Tab 空态（无 Agent 且无个人工作流）提供「从团队管线复制一份」与「新建编排」入口，禁止占位卡片

## 4. 今日待办下线（JS）

- [x] 4.1 移除 `renderTodos` / `loadTodos` / `addTodo` / `handleTodoAction` / `clearDoneTodos` 与相关 DOM 缓存
- [x] 4.2 移除 `knowme:add-todo` 事件监听
- [x] 4.3 保留 `workbench-todo-store.js` 与其 IPC（不删用户数据），确认无死引用告警

## 5. 样式

- [x] 5.1 工作模式 Tab 样式（选中态、窄窗）与我的 Agent 卡片样式（`wb-my-agent-card`）
- [x] 5.2 删除今日待办与来源 chip 的失效 CSS 选择器

## 6. 验证与证据

- [x] 6.1 更新 `tests/workbench-templates.test.js`：新增两 Tab 断言，移除今日待办与来源 chip 断言
- [x] 6.2 更新 Electron 冒烟 `shelf-electron-smoke.js`：Tab 切换、领域按 Tab 显隐、mine 内容/空态、无待办、无来源 chip
- [x] 6.3 `npm test` 全绿（1562/1562）
- [x] 6.4 `npm run lint` 无 error
- [x] 6.5 `npx openspec validate add-workbench-work-mode-tabs --strict` 通过
- [x] 6.6 Electron 实机自测：控制台零报错，截图团队管线 Tab、我的 Agent Tab、窄窗
- [x] 6.7 写 `evidence/dev-self-test.md`
