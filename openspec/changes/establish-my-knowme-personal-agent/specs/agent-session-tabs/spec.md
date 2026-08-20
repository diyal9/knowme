## MODIFIED Requirements

### Requirement: Session binds personal identity and context

自由协作 Session MUST 作为唯一“我的 KnowMe”人格下的主题持久化 `sessionKind=personal-topic`、`profileId=my-knowme` 与可选 `contextId`；多个主题的消息与草稿 MUST 隔离。

#### Scenario: Create a personal topic

- **WHEN** 用户在“我的 KnowMe”中新建主题
- **THEN** Session 绑定 `my-knowme` 并继承当前工作区情境
- **AND** 不再要求选择通用、知识管家、写作或编程人格

#### Scenario: Normalize a legacy mode session

- **WHEN** Reader 打开仍含旧 mode/agentId 且缺少 v3 绑定的 Session
- **THEN** UI 将其显示为“我的 KnowMe”主题
- **AND** Reader 保留旧字段，首次继续时仅补充新绑定

### Requirement: Session copy and visual conventions

Session Tab MUST 使用主题标题与“我的 KnowMe”身份视觉，不得以通用、知识管家、写作或编程人格胶囊作为切换入口。

#### Scenario: Render personal topic chrome

- **WHEN** 用户打开个人协作区
- **THEN** 顶栏展示“我的 KnowMe”与多个主题
- **AND** 快捷写作、编程和知识能力作为可触发 Skill 场景展示
