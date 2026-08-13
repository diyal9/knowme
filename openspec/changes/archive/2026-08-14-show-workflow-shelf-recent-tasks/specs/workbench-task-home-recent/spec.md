# workbench-task-home-recent (delta)

## MODIFIED Requirements

### Requirement: 任务首页「你的任务」仅展示专家任务

工作台「任务」Tab 的「你的任务 / 最近任务」MUST 仅展示无 `workflowId`（或 `workflowId` 为空）的专家任务。带 `workflowId` 的工作流任务 MUST 出现在「工作流」Tab 货架下方的「工作流任务」区，MUST NOT 在任务首页最近任务中重复展示。折叠预览、「更多 / 收起」与滚动行为保持不变。

#### Scenario: 专家任务出现在任务首页

- **WHEN** 用户创建无 `workflowId` 的专家任务并回到任务首页
- **THEN** 该任务出现在「最近任务」列表

#### Scenario: 工作流任务不混入任务首页

- **WHEN** 用户从货架启动带 `workflowId` 的任务并打开「任务」Tab
- **THEN** 「最近任务」不展示该条目
- **AND** 该条目可在「工作流」Tab 下方「工作流任务」中找到
