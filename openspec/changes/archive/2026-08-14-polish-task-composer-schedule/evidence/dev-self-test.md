# Dev self-test: polish-task-composer-schedule

Date: 2026-08-12

## Commands

- `npm test` → 1727/1727 pass
- `npm run lint` → ok

## Checks

- `openTaskComposer` 仅用显式 `goal`，不回填 `pendingGoal`
- 弹窗含 `wbTaskComposerScheduleEnabled` 与频率控件
- `beginExpertTask` create/update 可带 `scheduleEnabled` / `schedule`
- 知识库选项紧凑行；composer modal body 不 flex 撑空
