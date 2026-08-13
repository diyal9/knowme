## Why

`workbench.js` 已逾 1.2 万行，任务定时与 composer 逻辑内联，且产品叙事易让用户以为「已全自动无人值守发送」。`brain/memory/working/defer-task-schedule-with-automation.md` 已冻结：任务定时与工作流自动化应统一规划；本阶段须**诚实标注边界**并做低风险模块化，而非大爆炸重构。

## What Changes

- 抽出 `src/lib/workbench-task-composer-schedule.js`：composer 定时读写、字段同步、任务卡片 tooltip 文案。
- 工作台与自动化页补充**用户可见边界**：计划可写、需本机在线、到期创建协作而非代发消息；侧栏自动化未绑定管线时不假装已调度。
- 扫描 `polish-*` active changes，产出可 `/story-done` 或 archive 清单（不破坏未验收项）。
- 关联并收敛叙事：`enable-workbench-task-schedule`、`polish-task-composer-schedule`（实现已完成，本 change 补边界与结构）。

## 目标用户

使用专家任务定时或侧栏「自动化」的桌面用户；维护 workbench 的开发者。

## 验收标准

- composer / 任务卡片 / 自动化列表文案明确「非无人值守、需 App 在线」。
- `workbench.js` 减少内联 schedule 纯函数，经 lib + 薄包装调用。
- 新增/更新单测；`npm test` 相关子集与 `npm run lint` 通过。
- evidence 含 polish 归档清单。

## 非目标

- 不合并任务定时与工作流自动化数据模型。
- 不实现云端 cron、关机后台、自动发送消息。
- 不对 `workbench.js` 做无边界全量拆分。

## Capabilities

### New Capabilities

- `workbench-schedule-copy`: 任务定时与自动化边界的用户可见文案与 composer 模块契约。

### Modified Capabilities

- （无主规格 delta；叙事对齐 `enable-workbench-task-schedule`）

## Impact

- `src/lib/workbench-task-composer-schedule.js`（新）
- `src/workbench.js`、`src/workspace.html`
- `tests/workbench-task-composer-schedule.test.js`
