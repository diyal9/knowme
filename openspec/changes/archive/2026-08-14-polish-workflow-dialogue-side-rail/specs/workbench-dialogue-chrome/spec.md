## ADDED Requirements

### Requirement: Workflow dialogue status label uses conversation wording

工作流对话房顶栏状态标签 MUST 使用「对话中」，MUST NOT 使用「协作中」。纯专家协作对话房 MAY 继续使用「协作中」。

#### Scenario: Workflow chat shows 对话中

- **WHEN** 用户打开带 `workflowId` 的工作流对话房
- **THEN** 对话状态栏状态文案为「对话中」

#### Scenario: Expert chat may keep 协作中

- **WHEN** 用户打开无工作流绑定的专家任务对话房
- **THEN** 状态文案可为「协作中」
