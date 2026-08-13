## ADDED Requirements

### Requirement: Workbench expert-chat uses expert collab empty state

当工作台对话处于专家协作任务房（`expert-chat`）且消息列表为空时，系统 MUST 渲染专家协作空态（专家身份、专长与可行动协作入口），MUST NOT 渲染面向 Daemon/工作流的「协作引导」步骤空态。

#### Scenario: Expert task room empty is expert-centric

- **WHEN** 工作台 `expert-chat` 任务房打开且无历史消息
- **THEN** 用户看到围绕当前专家的协作首屏与开工动作
- **AND** 看不到「01 工作流 / 02 当前节点」类流程引导块

#### Scenario: Non-expert workbench empty unchanged

- **WHEN** 工作台处于工作流对话或管线协作空态
- **THEN** 既有流程引导空态仍可用
- **AND** 不被专家协作首屏替换

### Requirement: Expert collab empty reflects professional posture

专家协作空态 MUST 体现该专家的专业协作姿态（例如专长标签、职责/协作方式摘要或围绕该专家的开工提问），避免通用「流程指挥」口吻。

#### Scenario: Empty state mentions expert specialty

- **WHEN** 专家具有能力标签或 SOP 摘要
- **THEN** 空态可见至少一项与该专家相关的专业线索
