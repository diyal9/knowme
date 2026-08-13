## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Human approval before apply

Platform write MUST require an explicit approve action for all Feishu draft kinds. Approve MUST 经 CAS 状态机（pending→applying→applied）；并发批准 MUST at-most-once apply；拒绝 MUST 无副作用。

#### Scenario: Approve

- **WHEN** the user approves a pending draft
- **THEN** the connector executes the allowlisted command (or dry-run) and marks the draft applied on success

#### Scenario: Reject

- **WHEN** the user rejects a pending draft
- **THEN** no Feishu write occurs and the draft status becomes rejected
- **AND** 0 次外部写 API 调用
