## ADDED Requirements

### Requirement: Workflow task-room exposes ReAct progress

工作台以 task-room 打开的工作流对话 MUST 在左侧对话中展示与 Run plan 同步的 To-dos 进度（当 plan 非空时）。右栏工作流信息 MUST NOT 替代对话内 To-dos 作为唯一进度源。

#### Scenario: Workflow dialogue shows live To-dos

- **WHEN** 用户从货架进入工作流对话房并启动多步任务产生 plan
- **THEN** 左栏对话可见 To-dos 清单随执行更新
- **AND** 右栏仍可展示工作流属性，但不单独冒充执行清单
