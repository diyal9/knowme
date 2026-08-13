## MODIFIED Requirements

### Requirement: Workflow shelf opens an embedded dialogue workbench

用户从工作流货架启动工作流时，系统 MUST 在工作台保持打开并切换到 task-room：左侧为起点专家的持久 Session 对话，右侧为工作流任务上下文。系统 MUST 将任务与 `workflowId`（若有）关联，并支持从最近任务恢复同一 Session。MUST NOT 要求先经过居中介绍弹层或表单确认输入才能进入对话。

#### Scenario: Shelf launch lands in task-room dialogue

- **WHEN** 用户从货架打开可对话的工作流
- **THEN** 工作台进入 task-room
- **AND** 左侧显示专家对话，右侧显示工作流上下文
- **AND** 不切入独立助理表面作为唯一结果

#### Scenario: Resume workflow-linked session task

- **WHEN** 用户从最近任务打开 `execRef.kind === 'session'` 且任务带有 `workflowId` 的条目
- **THEN** 系统恢复同一 Session 并投影对应工作流右栏（若 package 仍可得）
