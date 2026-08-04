# Delta Spec: agent-chat-ux

## ADDED Requirements

### Requirement: Writing mode uses task-oriented quick actions

写作模式的空态卡片和快捷菜单 MUST 以文档任务为中心，而不是以提示词编辑为中心。

#### Scenario: Writing quick menu

- **GIVEN** 用户处于写作模式
- **WHEN** 打开 `Ctrl/Cmd+K` 快捷菜单
- **THEN** 用户能看到“写需求文档”“写办公文档”“按提纲成稿”“排版定稿”“润色去 AI 味”等动作
- **AND** 这些动作与空态卡片表达同一套任务心智

### Requirement: Long writing drafts open in review surface

写作模式生成的长文稿 SHOULD 默认进入右侧审阅区，而不是只留在聊天气泡内。

#### Scenario: Long output becomes draft

- **GIVEN** 用户触发写作任务且输出为长文稿
- **WHEN** 助手完成生成
- **THEN** 系统创建 draft artifact 并提供进入右侧审阅的入口
- **AND** 审阅区中能看到“写入当前编辑器”和“生成飞书文档草稿”等后续动作

### Requirement: Writing output removes common AI tone by default

写作模式的最终输出 MUST 默认做去 AI 味后处理，同时保留事实、术语和结构。

#### Scenario: Requirement doc keeps structure

- **GIVEN** 用户在写作模式中生成需求文档
- **WHEN** 返回最终文稿
- **THEN** 文稿结构清晰，保留验收、边界、风险等专业内容
- **AND** 减少空泛拔高、宣传腔和高频 AI 套话
