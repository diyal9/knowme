## ADDED Requirements

### Requirement: A single cultivatable personal agent

系统 MUST 提供唯一的 `my-knowme` 个人 Profile，并允许用户设置展示名称与二维头像；工作区和岗位变化 MUST 以情境覆盖表达，不得创建第二个人格。

#### Scenario: First use creates the singleton

- **WHEN** 用户首次读取“我的 KnowMe”且尚无个人 Profile
- **THEN** 系统按需创建 `id=my-knowme`、`agentId=personal`、`profileKind=personal` 的 Profile
- **AND** 不扫描全部知识或能力目录

#### Scenario: Switch workspace context

- **WHEN** 用户在另一个工作区继续使用“我的 KnowMe”
- **THEN** 系统绑定对应 `contextId` 并加载该情境覆盖
- **AND** 展示身份保持不变

### Requirement: Governed teaching and growth

个人代理 MUST 区分可立即应用的明确低风险记忆与必须确认的行为推断、Skill/知识装备或权限变化，并为所有变化保存可审计成长事件。

#### Scenario: Explicit low-risk remember

- **WHEN** 用户明确要求记住一条不含权限扩大或能力装备的偏好
- **THEN** 系统立即应用该记忆并返回可撤销引用
- **AND** 成长日志记录来源、时间与影响范围

#### Scenario: Inferred or privileged change

- **WHEN** 教导内容涉及行为推断、Skill/知识变更或权限扩大
- **THEN** 系统只创建待确认提案
- **AND** 在用户应用提案前 Profile 与权限不发生变化

### Requirement: Personal growth view

系统 MUST 提供独立培养视图，按需展示身份、情境、能力、知识、记忆、权限和有界成长日志。

#### Scenario: Open cultivate view

- **WHEN** 用户选择“培养我的 KnowMe”
- **THEN** 系统懒加载个人 Profile 与近期成长事件
- **AND** 提供身份和情境编辑及提案确认入口

### Requirement: Legacy personal settings projection

系统 MUST 兼容旧 `userProfile`、`userPrompt`、Soul 与四模式偏好，并只在读取/继续时投影为个人 Profile 或任务偏好，不覆盖原数据。

#### Scenario: Continue a legacy assistant session

- **WHEN** 用户继续一条缺少 `profileId` 的旧助理 Session
- **THEN** 系统为后续轮次绑定 `my-knowme`
- **AND** 原历史消息与旧字段保持不变
