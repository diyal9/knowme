## Purpose

定义工作流对话房在用户协作中采用 ReAct（思考→计划→执行→验收）且以可见 To-dos 清单呈现进度的行为契约，使多步工作流可观测、可验收，且不依赖伪造编排。

## ADDED Requirements

### Requirement: Workflow dialogue runs in ReAct mode

当 Session 关联工作流（存在非空 `workflowId`）且用户发起需要多步推进的任务时，系统 MUST 以 ReAct 模式运行：先形成或更新结构化计划，再执行工具/协作步骤，过程中更新计划状态，收尾前完成验收或明确未完成项。系统 MUST NOT 在无计划且多步任务仍进行时，以「已全部完成」口吻作为正常终态。

#### Scenario: Multi-step workflow task starts

- **WHEN** 用户在工作流对话房发送需要多步交付的目标
- **THEN** 该 Run 出现结构化 plan（To-dos），且至少包含计划与执行相关条目
- **AND** 模型通过 `update_plan`（或等价协议）推进条目状态

#### Scenario: Incomplete plan cannot claim full success

- **WHEN** plan 仍有 pending 或 doing 项且 Run 收敛
- **THEN** 最终答复 MUST 说明未完成项或阻塞原因
- **AND** MUST NOT 声称工作已全部完成

### Requirement: Visible To-dos track ReAct progress

工作流对话中，用户可见的 To-dos 清单 MUST 与 `run.plan` 同源；清单 MUST 展示项数，并区分进行中、待办、完成与阻塞。清单 MUST 随 `plan.updated`（或等价事件）增量更新，MUST NOT 用静态 Markdown 列表冒充可更新 To-dos。

#### Scenario: User sees To-dos during workflow run

- **WHEN** 工作流 Run 的 plan 含至少 1 条 item
- **THEN** 助手消息区域展示 To-dos 清单，标题含项数
- **AND** doing / pending / done / blocked 状态可区分

#### Scenario: Plan update refreshes To-dos

- **WHEN** 模型将某条目从 doing 标为 done
- **THEN** To-dos 对应该条目显示完成态
- **AND** 无需刷新整页会话

### Requirement: Acceptance is part of the loop

工作流多步任务的 ReAct 循环 MUST 包含验收语义：计划中 SHALL 有可识别的验收/核对项，或在完成关键交付项时写入短 evidence。系统 MUST NOT 在无验收迹象且用户期望交付物时静默结束为成功。

#### Scenario: Acceptance item or evidence present

- **WHEN** 工作流多步任务接近收敛且关键交付项已 done
- **THEN** plan 含验收相关项为 done，或关键项带有简短 evidence
- **AND** 用户可在 To-dos 中看到该进度

### Requirement: Non-workflow sessions are not hard-forced

未关联 `workflowId` 的专家/助理 Session MAY 使用同一 To-dos UI 与 `update_plan`，但系统 MUST NOT 仅因本能力而对全部非工作流会话强制 ReAct 硬门禁。

#### Scenario: Expert chat without workflow

- **WHEN** 用户在无 workflowId 的专家对话中发送简单问答
- **THEN** 系统可不生成 To-dos
- **AND** 行为不因本能力而强制失败
