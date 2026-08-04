# Tasks: agent-task-preflight-ask

- [x] 1. 新建 `agent-task-preflight-ask` change 工件与 `agent-chat-ux` specs 增量
- [x] 2. 在 `src/workspace-agent.js` 新增 `TASK_PREFLIGHT` 配置与 `PROMPT_TO_TASK` 反查表
- [x] 3. 新增 `shortcutHasMaterial` / `taskContextReady` / `askForTaskContent` / `runTaskCard` 及 `pendingShortcut` 状态
- [x] 4. 空态卡片点击与快捷菜单 `runQuickAction` 改走 `runTaskCard`
- [x] 5. `runAI` 顶部挂接 `pendingShortcut`：补齐素材后自动带上原任务指令续跑
- [x] 6. 知识管家 `remote-rag` 缺查询主题时一句话询问，不调用 LLM
- [x] 7. 补 `tests/workspace-agent.test.js` preflight 冒烟用例；执行 `npm test`、`npm run lint`，补写开发自测证据与 code-review
