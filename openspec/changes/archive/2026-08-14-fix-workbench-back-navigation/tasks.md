## 1. 来源捕获与恢复

- [x] 1.1 新增 `resolveReturnSurface()`：按 `activeSurface` / `activeManagePanel` 映射 `taskhome` | `shelf` | `daemon`
- [x] 1.2 改写 `captureTaskRoomReturnState`：写入真实 `surface`（不再写死 `tasks`）
- [x] 1.3 改写 `restoreTaskRoomReturnState`：按 `surface` 调用 `openManagePanel('daemon')` / `setSurface('shelf')` / `setSurface('taskhome')`

## 2. 入口接线

- [x] 2.1 `openDaemonTask`：进入前捕获 `taskRoomReturnState`（来自管线时为 `daemon`）
- [x] 2.2 `openExpertTaskRoom`：捕获来源；有 workflow 且未知来源时默认 `shelf`
- [x] 2.3 `closeExpertTaskRoom`：走 `restoreTaskRoomReturnState`
- [x] 2.4 `handleRunAction('back')`：改为 `backToRunList()`
- [x] 2.5 `launchPreparedIntent` / 货架启动路径确认 capture 使用 `resolveReturnSurface`

## 4. 回归修补（2026-08-13）

- [x] 4.1 `leaveDialogueTaskRoom` / `#wbRunBack` 不再因 `run.mode === 'daemon'` 强制回管线；统一 `backToRunList` 按来源恢复
- [x] 4.2 `backDaemonRunToPipelineTasks` 仅在来源为 `daemon` 时强制管线，否则委托 `backToRunList`
- [x] 4.3 对话模式标签 `dialogueModeFromOrigin` 与分类首页对齐；契约测试覆盖
- [x] 4.4 `npm test` / `npm run lint`；更新 `evidence/dev-self-test.md`
