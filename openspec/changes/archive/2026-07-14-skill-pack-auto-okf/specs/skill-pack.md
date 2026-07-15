# skill-pack-auto-okf Specs

## Purpose

同主题 ≥3 便签可封装为 OKF 技能包（一便签一文档），设置页可审改，AI 助写可引用。

## Requirements

### Requirement: Theme threshold prompt

当同一 `category` 下未封装技能且内容有效（≥8 字符）的便签达到 3 条，且该主题未被「暂不」时，MUST 向用户提示可封装为技能包。

#### Scenario: Reach threshold

- **WHEN** 用户将第 3 张同主题有效便签保存完成
- **THEN** 便签或总览收到建议事件，含主题键、数量与便签 id 列表

#### Scenario: Dismiss

- **WHEN** 用户选择「暂不」
- **THEN** 该主题不再自动提示，直至新增未封装便签使队列再次达阈（实现：清除 dismissed 当 eligible 增长自上次 dismiss 的 count）

### Requirement: One note one skill OKF

封装时 MUST 为每张参与便签各写一份 `skills/*.md`，frontmatter 含 `skill_pack` 与 `source_note_id`，并回写 `skillPackConceptId`。

#### Scenario: Generate pack

- **WHEN** 用户确认封装且主题有 ≥1 张 eligible 便签
- **THEN** 每张便签对应一个 conceptId，知识库 lint 通过

### Requirement: Settings review and edit

设置知识库 MUST 列出「技能包」主题，并允许编辑概念标题与正文后保存。

#### Scenario: Edit skill concept

- **WHEN** 用户在抽屉中修改标题/正文并保存
- **THEN** 再次读取该概念可见更新内容

### Requirement: AI assist uses skills

AI 助写请求 MUST 在动态上下文中注入与当前便签主题相关的技能摘要（若存在）。

#### Scenario: Related skill injected

- **WHEN** 用户对某主题便签发起助写且该主题已有技能文档
- **THEN** system 动态上下文包含「技能包」段落
