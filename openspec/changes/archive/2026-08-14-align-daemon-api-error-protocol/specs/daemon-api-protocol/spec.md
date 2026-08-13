## Purpose

Defines how KnowMe consumes the Daemon (pipeline service) HTTP API error envelope and keeps an in-repo protocol reference aligned with the upstream workflow-web caller docs.

## ADDED Requirements

### Requirement: Unified Daemon error envelope parsing

The system MUST parse unsuccessful Daemon JSON responses using the v1.0.0 envelope `{ detail: { code, message, errors? } }`, treating `detail.code` as the stable machine code for client branching.

#### Scenario: Structured detail code and message

- **WHEN** the Daemon returns HTTP 404 with body `{"detail":{"code":"task_not_found","message":"任务不存在：demo-x"}}`
- **THEN** the client result MUST have `ok: false`, `code: "task_not_found"`, and `error` equal to the server message

#### Scenario: Legacy string detail still yields readable error

- **WHEN** the Daemon returns HTTP 403 with body `{"detail":"需要授权码登录"}` and no machine code
- **THEN** the client MUST still surface a non-empty Chinese or fallback error string and MAY map to `auth_required` via status/message heuristics

#### Scenario: Top-level code compatibility

- **WHEN** a response provides a top-level `code` or `error_code` but no `detail.code`
- **THEN** the client MUST use that top-level code as the machine code

### Requirement: Auth vs permission error codes

The system MUST distinguish login-needed codes from resource-permission codes when branching UI.

#### Scenario: Login required codes

- **WHEN** `detail.code` is `auth_required` or `unauthorized`
- **THEN** the client MUST expose `code: "auth_required"` so existing Workbench auth guidance can trigger

#### Scenario: Task or tenant forbidden is not login prompt

- **WHEN** `detail.code` is `task_forbidden`, `tenant_forbidden`, or `forbidden`
- **THEN** the client MUST preserve that code and MUST NOT rewrite it to `auth_required`

### Requirement: Default message catalog fallback

When the error body has a known `code` but missing/empty message, the system MUST fall back to the documented Chinese default message for that code when available.

#### Scenario: Known code without message

- **WHEN** the body is `{"detail":{"code":"slug_invalid"}}` with empty message
- **THEN** the client error string MUST use the catalog default for `slug_invalid` (任务标识格式相关说明)

### Requirement: In-repo Daemon protocol document

The repository MUST contain a synced copy of the upstream Daemon caller API document under `docs/daemon/`, including version metadata and a KnowMe-specific note of consumed endpoints and known client extensions.

#### Scenario: Protocol doc present with version

- **WHEN** a developer opens `docs/daemon/API.md`
- **THEN** the document MUST state protocol version `1.0.0` (or newer synced version) and the unified error envelope shape

#### Scenario: KnowMe endpoint notes

- **WHEN** a developer opens `docs/daemon/README.md`
- **THEN** the notes MUST list KnowMe-consumed `/api/*` paths and MUST call out any client-only paths not present in the upstream catalog (for example workflow launch-context)
