## 1. DOM 与样式壳

- [x] 1.1 在 `workspace.html` 的 `#agentCol` 顶部增加对话状态栏结构（标题 + 返回按钮），默认隐藏
- [x] 1.2 在 `workbench-layout.css` / `workbench-shelf.css` 为状态栏增加贴顶、单行省略、左标题右操作样式，并仅在 task-room 布局显示
- [x] 1.3 扩展 `wb-expert-task-head`：左标题位 + 右状态，对齐 `.wb-run-topbar` 语言

## 2. 标题投影与返回

- [x] 2.1 在 `workbench.js` 实现 `syncDialogueStatusBar()`：按专家 / 工作流 / Daemon 投影标题，绑定与任务房/`backToRunList` 同一返回路径
- [x] 2.2 在进入/离开 task-room、刷新专家任务房、`syncRunTopbar` 时调用同步；总览隐藏状态栏
- [x] 2.3 调整 `syncHeadActionButton`：避免左栏状态栏、全局头、`#wbRunBack` 出现冲突性三重主返回

## 3. 右栏与空态

- [x] 3.1 `renderExpertTaskRoom` 写入右栏顶栏标题（专家名 / 工作流短名 / 任务目标）
- [x] 3.2 确认空态「当前工作」不再充当唯一身份；必要时弱化 kicker，不删引导内容

## 4. 测试与自测

- [x] 4.1 更新 `tests/workbench-templates.test.js`（或等价契约）：断言状态栏 DOM、task-room 可见性、返回控件存在
- [x] 4.2 本地 `npm test` 与 `npm run lint` 通过；Electron 冒烟：专家协作 / 工作流对话 / Daemon 审阅三条路径验证顶栏与返回
- [x] 4.3 撰写 `evidence/dev-self-test.md`
