## 1. OpenSpec & model

- [x] 1.1 扩展 `workbench-task-store` 的 schedule 相关字段与 normalize
- [x] 1.2 新增 `workbench-task-scheduler`（listDue / advanceAfterFire）与单测

## 2. Runtime IPC

- [x] 2.1 主进程分钟 tick：到期 advance + `workbench-task-schedule-due`
- [x] 2.2 preload 暴露 `onWorkbenchTaskScheduleDue`

## 3. UI

- [x] 3.1 任务页按钮改为「定时任务」并打开任务定时弹层
- [x] 3.2 任务行「定时」操作 + 计划徽章
- [x] 3.3 due 事件：创建子任务并 `beginExpertTask`，刷新列表

## 4. Verify

- [x] 4.1 `npm test` / `npm run lint`
- [x] 4.2 写入 evidence/dev-self-test.md、qa-plan、acceptance
