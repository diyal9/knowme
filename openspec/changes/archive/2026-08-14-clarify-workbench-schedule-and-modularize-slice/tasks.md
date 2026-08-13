## 1. OpenSpec & inventory

- [x] 1.1 创建 change `clarify-workbench-schedule-and-modularize-slice`（proposal / design / tasks / spec）
- [x] 1.2 扫描 `polish-*` active changes，写入 `evidence/polish-archive-inventory.md`

## 2. Modularize composer schedule

- [x] 2.1 新增 `src/lib/workbench-task-composer-schedule.js`（COPY、read/sync/reset、buildTaskScheduleTooltip）
- [x] 2.2 `workspace.html` 引入脚本；`workbench.js` 薄包装并删除内联实现
- [x] 2.3 单测 `tests/workbench-task-composer-schedule.test.js`

## 3. Schedule narrative copy

- [x] 3.1 Composer 定时开关与字段区边界文案（非无人值守、需在线）
- [x] 3.2 任务卡片 schedule tooltip 与 due toast 对齐真实行为
- [x] 3.3 自动化列表 hint：未绑定管线 / 调度不可用说明

## 4. Verify

- [x] 4.1 `npm test -- tests/workbench-task-composer-schedule.test.js tests/expert-task-chat-workbench.test.js tests/workbench-task-scheduler.test.js`
- [x] 4.2 `npm run lint`
- [x] 4.3 写入 `evidence/dev-self-test.md`、`qa-plan.md`
