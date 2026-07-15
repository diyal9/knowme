# skill-pack Specification

## Purpose

同主题提示词 ≥3 条可封装为 OKF 技能包（一便签一文档），设置页可审改，AI 助写可引用。

## Requirements

### Requirement: Theme threshold prompt

同 `category` 下未封装且内容有效的便签达到 3 条时，MUST 提示可封装为技能包。

#### Scenario: Reach threshold

- **WHEN** 第 3 张同主题有效便签保存完成
- **THEN** 当前主题便签显示封装横幅（封装 / 暂不）

### Requirement: One note one skill OKF

封装时 MUST 为每张参与便签写入 `skills/*.md`，并回写 `skillPackConceptId`。

#### Scenario: Generate pack

- **WHEN** 用户确认封装
- **THEN** 每张便签有对应 conceptId，lint 通过

### Requirement: Settings review and edit

设置知识库 MUST 支持编辑概念标题与正文并保存。

#### Scenario: Edit concept

- **WHEN** 用户修改并保存
- **THEN** 再次打开可见更新

### Requirement: AI assist uses skills

AI 助写 MUST 注入与当前主题相关的技能摘要（若存在）。
