## ADDED Requirements

### Requirement: Task-room surfaces expose dialogue identity chrome

工作台进入 task-room（专家协作对话、工作流对话、Daemon 运行带对话）时，系统 MUST 在对话工作间提供可读的身份顶栏（标题 + 至少一枚退路或主操作），使左侧对话与右侧任务/运行面板在视觉语言上对齐。助理独立模式的 Session Tab 顶栏行为 MUST NOT 被本要求破坏。

#### Scenario: Entering expert or workflow task-room shows identity chrome

- **WHEN** 用户打开专家协作或工作流对话房
- **THEN** 对话列顶部出现身份标题
- **AND** 用户可通过顶栏操作退回上一级列表或货架

#### Scenario: Assistant mode chrome unchanged

- **WHEN** 用户处于助理模式（非工作台 task-room）
- **THEN** 现有 Session Tab / 历史 / 更多入口行为保持可用
- **AND** 不强制替换为工作台对话状态栏
