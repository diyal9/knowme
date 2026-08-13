## 1. 统一投影层

- [x] 1.1 扩展 `workbench-task-lifecycle.js`：`projectRunLifecycle`、`outcomeLabelFor`、`compactLabelFor`、`isRunCancellable`
- [x] 1.2 单测 `tests/workbench-task-lifecycle.test.js`

## 2. Daemon cancel 封装

- [x] 2.1 `workbench-daemon-client.cancel(slug)`
- [x] 2.2 IPC `workbench-daemon-cancel` + preload `workbenchDaemonCancel`
- [x] 2.3 单测 `tests/workbench-daemon-client.test.js`

## 3. UI 对齐

- [x] 3.1 `renderDaemonRunner`：可取消时显示「停止」；处理 `daemon-cancel`
- [x] 3.2 `runOutcomePresentation` / `daemonRunStatusLabel` / `agentGraphStatusLabel` 接入统一投影

## 4. 自测与证据

- [x] 4.1 `npm test` / `npm run lint`
- [x] 4.2 `evidence/dev-self-test.md`（live cancel 缺 token 标 BLOCKED）
