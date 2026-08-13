# connector-feishu-write-review Specification

## Purpose
TBD - created by archiving change connector-feishu-write-review. Update Purpose after archive.
## Requirements
### Requirement: Drafts do not write to Feishu

Creating a write draft MUST NOT invoke Feishu create/update/delete APIs for any draft type（文档、IM、任务、日历、云盘、Wiki、Bitable）。

#### Scenario: Draft tool

- **WHEN** the model calls any `feishu.draft_*` write tool with required body
- **THEN** a pending_review draft is stored locally and the tool result tells the user confirmation is required

### Requirement: Human approval before apply

Platform write MUST require an explicit approve action for all Feishu draft kinds. Approve MUST 经 CAS 状态机（pending→applying→applied）；并发批准 MUST at-most-once apply；拒绝 MUST 无副作用。

#### Scenario: Approve

- **WHEN** the user approves a pending draft
- **THEN** the connector executes the allowlisted command (or dry-run) and marks the draft applied on success

#### Scenario: Reject

- **WHEN** the user rejects a pending draft
- **THEN** no Feishu write occurs and the draft status becomes rejected
- **AND** 0 次外部写 API 调用

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

### Requirement: Draft store CAS state machine

tool draft store MUST 使用状态机：`pending` → `applying` → `applied`|`rejected`|`failed`。`approve` 操作 MUST 使用 CAS：仅当当前状态为 `pending` 时可转为 `applying`；并发批准 MUST 保证 at-most-once apply。

#### Scenario: Double approve returns not_pending

- **WHEN** 两窗口/快速连点对同一 draftId 批准
- **THEN** 恰好一次 apply 成功
- **AND** 第二次返回 `not_pending` 且无重复副作用

#### Scenario: Applying state visible

- **WHEN** draft 处于 applying
- **THEN** UI 批准按钮 disabled 且显示 loading

#### Scenario: Windows EPERM rename retry

- **WHEN** Windows 上 apply 因 EPERM rename 失败
- **THEN** 系统 MUST 指数退避重试最多 3 次
- **AND** 仍失败则状态为 failed 且可恢复

### Requirement: Unified approve IPC with legacy proxy

系统 MUST 提供单一 `toolApproveDraft(draftId, meta)` 实现；legacy IPC 名（如 `approveFeishuDraft`）MAY 保留为薄代理。审计 MUST 记录 approverId、sessionId、runId。

#### Scenario: Legacy IPC delegates to unified handler

- **WHEN** 调用 legacy approve Feishu IPC
- **THEN** 行为与 unified handler 一致
- **AND** audit 字段完整

