## 1. Surface routing

- [x] 1.1 `applyWorkbench`：工作台开启时一律 `setSurfaceMode('workbench')`，移除 expert/workflow → agent 特例
- [x] 1.2 `setSurfaceMode`：切到 workbench 时也 `activateSurfaceSession`，与助理对称

## 2. Workbench session create/resume

- [x] 2.1 `startExpertChat` 支持 `surface: 'workbench'|'agent'`（默认 agent）
- [x] 2.2 `startExpertTaskChat` / `resumeExpertTaskChat` 在 workbench surface 上创建或恢复 Session

## 3. Migration and guards

- [x] 3.1 `loadSessions` 将工作台归属 Session 从 agent.openIds 迁到 workbench.openIds
- [x] 3.2 归属判定覆盖 `taskRef.kind=workbench-task` 与「工作台 ·」goal/标题

## 4. Tests and docs

- [x] 4.1 更新 `expert-task-chat-workbench` / `workbench-templates` / `workspace-agent` 断言
- [x] 4.2 补充 qa-plan / acceptance；跑 `npm test` 与 `npm run lint`
