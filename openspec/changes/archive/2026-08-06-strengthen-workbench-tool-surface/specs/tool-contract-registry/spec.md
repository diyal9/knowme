## Purpose

为 KnowMe 工作台所有 Agent 工具提供统一契约、注册表、结果 envelope 与审计标识，使 Hub、Executor、Eval 与 UI 对工具能力、风险与副作用有一致语义。

## ADDED Requirements

### Requirement: Every registered tool declares a Tool Contract

系统 MUST 维护 Tool Registry；每个进入 Agent 投影的工具 MUST 声明契约字段：`source`（builtin|connector|mcp|feishu）、`capability`、`risk`（read|write|destructive|network|external）、`sideEffects`（boolean）、`requiresApproval`（boolean）、`scope`（content-source|sandbox|external|ephemeral）、`timeoutMs`、`idempotencySupported`（boolean）、`rollbackSupported`（boolean）、`healthCheck`（optional id）。

#### Scenario: Missing contract blocks projection

- **WHEN** 某工具定义缺少 `risk` 或 `source`
- **THEN** Registry MUST 拒绝注册
- **AND** 该工具 MUST NOT 出现在 Agent tool definitions

#### Scenario: Hub reads same contract as Agent

- **WHEN** Capability Hub 预览 Connector 工具列表
- **THEN** 展示字段 MUST 与 Registry 中契约一致（含 risk 与 requiresApproval）

### Requirement: Unified tool result envelope

每次工具执行 MUST 返回 envelope：`ok`（boolean）、`code`（string）、`text`（string）、`preview`（string，UI 摘要）、`truncated`（optional boolean）、`artifactRefs`（optional array）、`auditId`（string）、`requiresApproval`（optional boolean）、`draftId`（optional string）。

#### Scenario: Success with artifact

- **WHEN** 工具创建本地 artifact
- **THEN** envelope 含 `artifactRefs` 至少一项 `{ id, kind, path? }`
- **AND** `auditId` 非空

#### Scenario: Failure preserves code

- **WHEN** 工具因权限拒绝执行
- **THEN** `ok=false` 且 `code` 为稳定机器可读值（如 `approval_required`、`scope_denied`）
- **AND** `text` 含用户可行动的中文说明

### Requirement: Schema validation before execute

Registry MUST 在 execute 前校验参数 JSON Schema（或等价校验）；校验失败 MUST NOT 调用 handler。

#### Scenario: Invalid args rejected

- **WHEN** 模型传入缺少 required 字段的参数
- **THEN** 返回 `code=invalid_args`
- **AND** MUST NOT 产生副作用

### Requirement: Audit log for side-effecting tools

凡 `sideEffects=true` 或 `requiresApproval=true` 的工具，执行与批准 MUST 写入 `%APPDATA%\KnowMe\audit\tool-audit.jsonl`（append-only），含 `auditId`、toolName、runId、timestamp、outcome。

#### Scenario: Approved write is audited

- **WHEN** 用户批准一条 file write draft 并成功应用
- **THEN** audit 日志含 outcome=applied 与 target path 摘要
