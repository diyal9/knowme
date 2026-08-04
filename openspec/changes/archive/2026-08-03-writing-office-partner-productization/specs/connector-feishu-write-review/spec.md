# Delta Spec: connector-feishu-write-review

## ADDED Requirements

### Requirement: Writing review can promote a local draft into a Feishu write draft

写作模式中的长文稿在本地审阅通过前，MUST NOT 直接写入飞书；用户确认后 MAY 生成待审批的飞书文档草稿。

#### Scenario: Create Feishu draft from writing review

- **GIVEN** 用户在写作模式中生成了长文稿 draft artifact
- **WHEN** 用户在审阅区选择“生成飞书文档草稿”
- **THEN** 系统调用 `feishu.draft_write_doc` 创建本地 pending_review 草稿
- **AND** MUST NOT 立即执行远端创建文档

#### Scenario: Approve after draft creation

- **GIVEN** 已存在 `feishu.draft_write_doc` 生成的 pending_review 草稿
- **WHEN** 用户确认应用
- **THEN** 系统才执行既有允许名单写入流程
- **AND** 拒绝后不应有任何飞书写入发生
