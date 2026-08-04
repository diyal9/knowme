# connector-feishu-write-review Specification

## Purpose
TBD - created by archiving change connector-feishu-write-review. Update Purpose after archive.
## Requirements
### Requirement: Drafts do not write to Feishu

Creating a write draft MUST NOT invoke Feishu create/update APIs.

#### Scenario: Draft tool

- **WHEN** the model calls `feishu.draft_write_doc` with a body
- **THEN** a pending_review draft is stored locally and the tool result tells the user confirmation is required

### Requirement: Human approval before apply

Platform write MUST require an explicit approve action.

#### Scenario: Approve

- **WHEN** the user approves a pending draft
- **THEN** the connector executes the allowlisted create command (or dry-run) and marks the draft applied on success

#### Scenario: Reject

- **WHEN** the user rejects a pending draft
- **THEN** no Feishu write occurs and the draft status becomes rejected

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

