## ADDED Requirements

### Requirement: Per-run permission gate on registry hot path

`resolveToolSurfaceForRun(runId, policy)` MUST 在投影与 execute 前应用 Run 级 allowlist、Expert 快照 bindings、Connector 授权与 sandbox scope；未授权工具 MUST NOT 进入模型 tool definitions。

#### Scenario: Undeclared tool blocked at projection

- **WHEN** 子 Run policy 未允许 `file.write`
- **THEN** 工具定义列表 MUST NOT 含 `file.write`
- **AND** 强行调用返回 `ok=false, code=scope_denied`

#### Scenario: Parent and child runs have independent surfaces

- **WHEN** 父 Run 允许 orchestration 工具而子 Run 不允许
- **THEN** 子 Run 投影 MUST NOT 含 `delegate_to_expert`
- **AND** 父 Run 仍可按 policy 保留 orchestration 工具

### Requirement: Contract timeout enforced at execute wrapper

Registry execute wrapper MUST 对每个工具施加契约 `timeoutMs` 与 Run 剩余预算的较小值；超时 MUST abort handler 并返回 `ok=false, code=timeout`。

#### Scenario: Tool exceeds timeoutMs

- **WHEN** handler 在 `timeoutMs` 内未返回
- **THEN** wrapper abort 并返回 timeout envelope
- **AND** audit 记录 outcome=timeout（若 sideEffects 工具）

#### Scenario: Cancel signal aborts in-flight tool

- **WHEN** Run 收到 abort 且工具仍在执行
- **THEN** wrapper MUST 中断 handler（best-effort）
- **AND** 返回 `ok=false, code=cancelled`

### Requirement: Idempotency key deduplication within run scope

对 `idempotencySupported=true` 的工具，execute wrapper MUST 接受 `idempotencyKey` 并在同一 `runId` 内 dedup：重复 key MUST 返回首次 envelope 副本而 MUST NOT 重复副作用。

#### Scenario: Duplicate idempotent write returns receipt

- **WHEN** 同一 runId 内以相同 idempotencyKey 两次调用 feishu draft 工具
- **THEN** 第二次返回首次 `auditId` 与结果
- **AND** MUST NOT 创建第二个 draft

#### Scenario: Different runs do not share idempotency cache

- **WHEN** 父 Run 与子 Run 使用相同 idempotencyKey
- **THEN** 两次执行 MUST 各自独立（除非 workflow 显式共享 receipt 域）

### Requirement: Per-run approval and audit linkage

`requiresApproval=true` 的工具在 Run 级 MUST 写入 pending_review 状态；批准 MUST 关联 `runId`、`subRunId`（若适用）、`auditId` 与 approverId 到 tool-audit chain。

#### Scenario: Child run draft requires approval

- **WHEN** 子 Run 调用 feishu.draft_* 返回 draftId
- **THEN** envelope 含 `requiresApproval=true`
- **AND** audit 含 parentRunId 与 subRunId

#### Scenario: Unapproved write fail-closed in verify

- **WHEN** 子 Run 产生 pending_review 写操作
- **THEN** 父/子 VERIFY 阶段 MUST NOT 将外部写标记为 applied 证据
- **AND** 等待用户 approve 后才可记 applied

### Requirement: Registry rejects tools missing run governance fields

新增或更新 Tool Contract 时，生产热路径使用的工具 MUST 声明 `timeoutMs`、`risk`、`scope` 与 `idempotencySupported`；缺失时 MUST 拒绝注册或拒绝进入 v1 投影。

#### Scenario: Missing timeout blocks v1 projection

- **WHEN** 工具契约缺少 `timeoutMs`
- **THEN** v1 resolver MUST NOT 投影该工具
- **AND** Hub 预览显示 governance 缺失警告

### Requirement: Orchestration tools registered with run-scoped contracts

`delegate_to_expert`、`await_sub_run`、`get_sub_run_status` 与 `handoff_artifact` MUST 在 Registry 中声明 orchestration capability、read risk、无 sideEffects（delegate 本身）及 run 级 timeout；execute MUST 经 RunManager 而非裸 handler。

#### Scenario: Orchestration tool uses RunManager port

- **WHEN** 模型调用 `delegate_to_expert`
- **THEN** Registry wrapper 调用 RunManager spawn
- **AND** 返回 envelope 含 subRunId/runId 与 auditId

#### Scenario: Legacy surface hides orchestration tools

- **WHEN** `KNOWME_TOOL_SURFACE=legacy`
- **THEN** resolver MUST NOT 暴露 v1 orchestration 工具
- **AND** MUST NOT 绕过 Run 治理启动子 Run
