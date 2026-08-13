## ADDED Requirements

### Requirement: Daemon HITL 交互在左栏对话完成

Daemon 运行面等待 Gate 或澄清（need_input / pending_clarifications / pending_gates）时，MUST 在左栏对话流展示对应人机交互卡片。澄清提问文案 MUST 出现在对话记录中；用户 MUST 能通过对话输入框发送回答来提交澄清。Gate MUST 在对话卡片内提供通过 / 修订 / 打回操作。主路径 MUST NOT 依赖右栏底栏「回答」按钮或「补充任务信息」模态框。

#### Scenario: 澄清出现在对话

- **WHEN** Daemon 任务进入等待澄清（pending_clarifications 非空）
- **THEN** 左栏对话流出现澄清提问卡片，且右栏底栏不出现「回答」按钮
- **AND** 不自动弹出「补充任务信息」模态框

#### Scenario: 在对话中提交澄清

- **WHEN** 澄清等待中且用户在输入框填写内容并发送
- **THEN** 系统将该内容作为澄清回答提交至 Daemon，用户消息出现在对话记录中
- **AND** 提交成功后任务继续（澄清等待解除）

#### Scenario: Gate 在对话中确认

- **WHEN** Daemon 任务进入等待 Gate（pending_gates 非空）
- **THEN** 左栏对话流出现 Gate 卡片，含通过 / 修订 / 打回
- **AND** 用户点选后提交 Gate 决策，任务继续

#### Scenario: 底栏无孤立回答入口

- **WHEN** 仅存在澄清等待、且无其他必要右栏动作
- **THEN** `#wbRunnerActions` 不展示「回答」按钮；无动作时底栏可隐藏
