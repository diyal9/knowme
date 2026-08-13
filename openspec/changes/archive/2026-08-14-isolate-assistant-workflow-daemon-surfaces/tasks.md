## 1. Surface exit & process feed guards

- [x] 1.1 `openAgentChat`：离开工作台时退出 task-room（`setWorkbenchTaskView(false)` 或等价），确保调用 `exitWorkbenchTask`
- [x] 1.2 `setSurfaceMode('agent')`：切换时先 `setDaemonProcessFeed(null)`，再激活助理 Session
- [x] 1.3 `restoreDaemonProcessFeedAfterChatRender` / `paintDaemonProcessFeed`：非 workbench surface 强制清空，不绘制过程块

## 2. Ownership heuristics

- [x] 2.1 加宽 `isWorkbenchOwnedSession`：匹配「工作台」+ `·`/`-`/`—`/`–` 等间隔符前缀
- [x] 2.2 确认加载迁移仍调用 `relocateWorkbenchSessionsFromAgentSurface`

## 3. Tests & docs

- [x] 3.1 更新/新增 `tests/workspace-agent.test.js`（及必要时 workspace/workbench 静态契约）锁定守卫与归属正则
- [x] 3.2 补充 `qa-plan.md` / `acceptance.md`；跑 `npm test` 与 `npm run lint`
- [x] 3.3 写 `evidence/dev-self-test.md`
