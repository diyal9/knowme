## 1. 数据层

- [x] 1.1 Daemon client：`progress` / `logs` / `events` / `changes` + `requestText`
- [x] 1.2 IPC + preload 暴露 API
- [x] 1.3 `workbench-daemon-review.js` 投影 + 单测

## 2. 右栏审阅

- [x] 2.1 DOM：审阅头 / Tab / 推荐条 / 体 / 底部动作
- [x] 2.2 `renderDaemonReview` 替换 daemon 旧 task-context 主呈现
- [x] 2.3 样式

## 3. 左栏过程对话

- [x] 3.1 agent 过程 feed 挂载
- [x] 3.2 refresh 时同步 progress/logs
- [x] 3.3 「查看过程日志」聚焦左栏

## 4. 质量

- [x] 4.1 `npm test` / `npm run lint`
- [x] 4.2 evidence/dev-self-test.md
