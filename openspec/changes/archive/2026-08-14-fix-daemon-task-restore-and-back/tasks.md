## 1. 冷启动恢复

- [x] 1.1 `restoreTaskFromDraft`：终态 phase 或（在线且 slug 不在 tasks）时清草稿并跳过打开
- [x] 1.2 可恢复路径调用 `openDaemonTask(..., { silent: true, returnSurface: intent.returnState?.surface || 'daemon' })`
- [x] 1.3 `openExistingLaunchRun` 对 daemon 默认 `returnSurface` 为 `daemon`
- [x] 1.4 `openDaemonTask`：无 UI/显式来源时默认 `daemon`；`silent` 且刷新失败时清草稿并退出运行面，返回 false

## 2. 返回时序

- [x] 2.1 `backToRunList`：先 `resetRun` + `restoreTaskRoomReturnState`，再 `void refreshRunDirectory()`
- [x] 2.2 `backDaemonRunToPipelineTasks` 同步调整，避免阻塞导航

## 3. 契约与自测

- [x] 3.1 更新 `tests/workbench-templates.test.js` 断言
- [x] 3.2 `npm test` / `npm run lint`；写 `evidence/dev-self-test.md`
