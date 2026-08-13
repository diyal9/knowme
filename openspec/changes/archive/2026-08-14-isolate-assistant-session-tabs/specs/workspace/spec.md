## ADDED Requirements

### Requirement: Workbench dialogue rooms use workbench session surface

工作台处于开启状态时（含专家任务对话房、工作流对话房、Daemon/任务工作间）MUST 使用工作台 Session surface，MUST NOT 为了复用对话组件而把这些 Session 写入助理 surface。

#### Scenario: Expert or workflow chat room stays on workbench surface

- **WHEN** 工作台展开 `expert-chat` 或 `workflow-chat` 任务工作间
- **THEN** 当前 Session surface 为工作台
- **AND** 创建或恢复的专家 Session 记入工作台打开集合

#### Scenario: Leaving workbench restores assistant tabs only

- **WHEN** 用户关闭工作台并进入助理
- **THEN** Session Tab 栏恢复为助理打开集合
- **AND** 不展示工作台任务 / Daemon / 工作流对话 Session
