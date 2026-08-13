## Context

`renderTaskRecentRow` 页脚用 `data-icon="users"`；`renderTaskManageItem` 已用 `resolveTaskManageExpert` + `agentAvatarMark`。对齐即可。

## Decisions

1. **解析**：复用 `resolveTaskManageExpert(task)`，从 `availableExperts()` 按 `expertId` 取头像。
2. **渲染**：`agentAvatarMark(expert, 'wb-task-card-avatar', 18)`，与管理弹窗同源。
3. **工作流**：`taskHasWorkflowId` 时仍用 `workflow` 图标。
4. **样式**：`.wb-task-card-avatar` 18×18 圆角裁切，与 intent 行对齐。

## Risks

- 专家已删但任务仍在：回退语义图标 + `expertName` 文案，可接受。
