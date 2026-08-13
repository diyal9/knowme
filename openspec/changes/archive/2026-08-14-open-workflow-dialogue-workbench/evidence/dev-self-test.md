# 开发自测报告

- 日期：2026-08-12
- Change：`open-workflow-dialogue-workbench`
- npm test: PASS
- npm run lint: PASS
- 相关单测：`workbench-templates` / `workbench-task-store` / `expert-task-chat-workbench` PASS
- 手动冒烟: 待真机点货架卡片验证双栏（重启后）

## 变更摘要

- 货架卡片 / play → `openWorkflowDialogueRoom` → 起点专家 Session + task-room
- 右栏投影工作流 I/O、步骤、能力；次要「开始运行」→ `beginWorkflowRun`
- 任务 store 持久化 `workflowId` / `workflowName`
- `workflow-chat` 与 `expert-chat` 同为对话表面

## 备注

详情弹层 / 表单确认输入不再作为货架主入口。
