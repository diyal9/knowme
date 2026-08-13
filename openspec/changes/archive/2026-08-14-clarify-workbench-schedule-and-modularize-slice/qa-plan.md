# QA Plan — clarify-workbench-schedule-and-modularize-slice

## Smoke Scope

- [ ] 打开「+ 新建任务」，勾选定时：可见边界文案（在线、非代发）
- [ ] 创建带定时的任务：最近任务卡片 clock 标记 tooltip 含计划与在线提示
- [ ] 侧栏「自动化」：顶栏 hint 说明未绑定管线不会自动调度
- [ ] 控制台无 uncaught error

## Regression

- [ ] `npm test` 子集（composer-schedule / expert-task-chat / task-scheduler）
- [ ] `npm run lint`

## Out of scope

- 真实 tick 到期 E2E（需等待或改系统时间）
- 工作流自动化 scheduler 实现
