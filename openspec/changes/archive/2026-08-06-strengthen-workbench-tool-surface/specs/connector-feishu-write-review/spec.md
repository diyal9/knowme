## ADDED Requirements

### Requirement: Feishu write draft catalog

系统 MUST 为下列写操作提供 `feishu.draft_*` 工具（名称稳定、allowlist 控制），创建时 MUST NOT 调用远端写 API：文档 create/update/append；IM send/reply；任务 create/update/complete；日历 create/update/cancel；云盘 upload/move/mkdir；Wiki node create/move；Bitable record create/update/delete。

#### Scenario: Draft doc append

- **WHEN** 模型调用 `feishu.draft_append_doc` 含 doc token 与 append body
- **THEN** 本地 pending_review draft 存储预览
- **AND** MUST NOT 调用远端 append

#### Scenario: Draft IM message

- **WHEN** 模型调用 `feishu.draft_send_message` 含 chat_id 与 text
- **THEN** draft 含消息预览与目标 chat
- **AND** requiresApproval=true

### Requirement: Idempotency keys for external writes

每个 Feishu write draft MUST 接受 optional `idempotencyKey`；相同 key 的 pending/applied draft MUST NOT 重复创建远端资源。

#### Scenario: Duplicate apply prevented

- **WHEN** 相同 idempotencyKey 的 draft 已 applied
- **THEN** 再次 approve 返回 `already_applied` 且不二次写

### Requirement: Retry boundaries and permission errors

apply 失败时 MUST 返回 Feishu/CLI 原文错误；仅 `timeout`/`network`/`rate_limit` 类 MAY 自动重试（≤2 次）；`403/scope` MUST NOT 重试。

#### Scenario: Scope error surfaced

- **WHEN** apply 因缺少 IM 写权限失败
- **THEN** 用户可见 scope 名称与 Hub 授权指引

## MODIFIED Requirements

### Requirement: Drafts do not write to Feishu

Creating a write draft MUST NOT invoke Feishu create/update/delete APIs for any draft type（文档、IM、任务、日历、云盘、Wiki、Bitable）。

#### Scenario: Draft tool

- **WHEN** the model calls any `feishu.draft_*` write tool with required body
- **THEN** a pending_review draft is stored locally and the tool result tells the user confirmation is required

### Requirement: Human approval before apply

Platform write MUST require an explicit approve action for all Feishu draft kinds.

#### Scenario: Approve

- **WHEN** the user approves a pending draft
- **THEN** the connector executes the allowlisted command (or dry-run) and marks the draft applied on success

#### Scenario: Reject

- **WHEN** the user rejects a pending draft
- **THEN** no Feishu write occurs and the draft status becomes rejected
