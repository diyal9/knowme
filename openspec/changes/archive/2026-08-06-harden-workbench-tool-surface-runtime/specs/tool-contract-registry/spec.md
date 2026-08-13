## ADDED Requirements

### Requirement: Production hot path uses single tool surface resolver

Agent Run 生产路径 MUST 通过唯一 resolver（如 `resolveToolSurfaceForRun`）组装工具面；该 resolver MUST 从 Tool Registry 投影、校验契约并包装 execute 以强制 result envelope 与 audit。MUST NOT 在生产路径绕过 Registry 直接调用 legacy `createToolSurface` 裸投影。

#### Scenario: Agent run uses registry-backed surface

- **WHEN** `KNOWME_TOOL_SURFACE=v1` 且 Agent Run 开始
- **THEN** 工具定义 100% 来自 Registry 投影
- **AND** 每次 side-effect 执行返回统一 envelope 且含非空 `auditId`（当契约要求时）

#### Scenario: Legacy flag bypasses v1 bundle only

- **WHEN** `KNOWME_TOOL_SURFACE=legacy`
- **THEN** resolver MUST 返回 legacy 子集（只读文件 + 既有 Feishu draft）
- **AND** MUST NOT 暴露 v1 write/run_task/orchestration 工具

### Requirement: Execute wrapper validates contract before handler

Registry resolver MUST 在调用工具 handler 前校验参数 schema 与契约字段；校验失败 MUST 返回 `invalid_args` 且 MUST NOT 调用 handler。

#### Scenario: Invalid args blocked at wrapper

- **WHEN** 模型传入缺少 required 字段的工具参数
- **THEN** envelope 为 `ok=false, code=invalid_args`
- **AND** audit 记录 outcome=validation_failed（若 sideEffects 工具）

## MODIFIED Requirements

### Requirement: Audit log for side-effecting tools

凡 `sideEffects=true` 或 `requiresApproval=true` 的工具，执行与批准 MUST 写入 `%APPDATA%\KnowMe\audit\tool-audit.jsonl`（append-only）。每条记录 MUST 含：`auditId`、`toolName`、`runId`、`sessionId`、`timestamp`、`outcome`、`approverId`（若适用）、`targetSummary`（脱敏后）。系统 MUST 维护最小 tamper-evident hash chain：`prevHash` 与 `recordHash`（SHA-256 over canonical JSON）；MUST NOT 宣称密码学不可抵赖。写失败 MUST 记录可见错误且 MUST NOT 静默丢弃。

#### Scenario: Approved write is audited with chain

- **WHEN** 用户批准一条 file write draft 并成功应用
- **THEN** audit 含 outcome=applied、target path 摘要、approverId、runId
- **AND** 记录含有效 `prevHash`/`recordHash` 链

#### Scenario: Audit write failure is visible

- **WHEN** audit 文件不可写
- **THEN** 主进程记录 error 级别日志
- **AND** 工具 envelope MAY 含 `auditWarning` 供开发诊断

#### Scenario: Sensitive fields redacted

- **WHEN** 工具参数或结果含 token/password/authorization/secret
- **THEN** audit 与 console 日志 MUST 脱敏为 `[REDACTED]`
