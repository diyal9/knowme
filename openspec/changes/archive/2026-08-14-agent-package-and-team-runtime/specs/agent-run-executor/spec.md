## ADDED Requirements

### Requirement: ORCHESTRATE phase delegates through RunManager port

`AgentRunExecutor` 在 `ORCHESTRATE` 阶段 MUST 经 RunManager/Launcher port 创建、等待与汇总子 Run；MUST NOT 直接调用 main.js 内联 spawn 占位实现。

#### Scenario: Delegate enters orchestrate with real child runId

- **WHEN** 父 Run 调用 `delegate_to_expert`
- **THEN** runPhases 含 `ORCHESTRATE`
- **AND** emit 事件含真实子 `runId`（非仅 subRunId 占位）
- **AND** 子 Run 在 RunStore 中可查询

#### Scenario: Await blocks orchestrate until child terminal

- **WHEN** workflow 要求 await 子 Run
- **THEN** 父 Executor 在 `ORCHESTRATE` 等待子 Run terminal 或 timeout
- **AND** 等待期间父 Run MUST 响应 cancel 信号

### Requirement: Child run timeout and budget enforcement

Executor MUST 为每个子 Run 继承父 Run 的剩余预算并施加契约 `timeoutMs`；超时 MUST 触发 abort 且子 Run 终态为 `ERROR` 或 `CANCELLED`（按策略）。

#### Scenario: Child exceeds run timeout

- **WHEN** 子 Run 执行超过 Team/Run policy 的 `runTimeoutMs`
- **THEN** RunManager abort 子 Executor
- **AND** 父 Run 收到 `code=subrun_timeout` 结构化 summary

#### Scenario: Cancelled parent stops child budget

- **WHEN** 父 Run 已 `CANCELLED`
- **THEN** 子 Run MUST NOT 继续消耗 LLM 或工具预算
- **AND** 子 Run 在 ≤3s 内达 `CANCELLED`

### Requirement: Parent aggregates child evidence and tool ledgers

父 Run 在子 Run 终态后 MUST 合并子 Run 的 EvidenceLedger、ToolLedger 摘要与 artifactRefs 到父账本（按 workflow 声明）；未验证外部事实 MUST NOT 因合并而放行。

#### Scenario: Child evidence merged on success

- **WHEN** 子 Run 以 `DONE` 终止且产出 ok ledger 条目
- **THEN** 父 Run GROUND/VERIFY 阶段可见合并后的 digest 引用
- **AND** 父 answer MUST NOT 引用子 Run 未验证事实

#### Scenario: Child blocked output does not bypass parent gate

- **WHEN** 子 Run OutputGate blocked
- **THEN** 父 Run MUST NOT 将 blocked 文本当作 verified 证据
- **AND** 父 trace 展示子 Run blocked 原因

### Requirement: Executor integrates orchestration cancel port

`ai-cancel-run` 与 AbortSignal MUST 经 RunManager 调用 `cancelSubRun(runId)` 取消所有关联子 Run；实现 MUST 在 **≤3s** 内使子 Run 达 `CANCELLED` 终态。

#### Scenario: Parent cancel during orchestrate

- **WHEN** 父 Run 处于 `ORCHESTRATE` 且存在 running 子 Run
- **AND** 用户触发 `ai-cancel-run`
- **THEN** 所有子 Run 终态为 `CANCELLED`
- **AND** MUST NOT 遗留 running 子 Run 超过 3s

#### Scenario: Electron E2E cancel no leak

- **WHEN** Electron smoke 触发 delegate 后立即 cancel
- **THEN** trace 中子 Run 步骤显示 cancelled
- **AND** 无新增 tool 调用事件

### Requirement: Idempotent sub-run launch via RunStore receipt

Executor/RunManager MUST 为每次 spawn 写入幂等收据 `(parentRunId, nodeId, attemptKey) → childRunId`；重复 spawn MUST 返回已有 childRunId。

#### Scenario: Duplicate spawn returns existing child

- **WHEN** 同一 attemptKey 在窗口内重复 delegate
- **THEN** 不启动第二个 Executor
- **AND** 返回已有 childRunId 与当前 phase/status

### Requirement: Cross-builder child runs use agent service protocol port

当子 Run 绑定非本地 Builder 时，Executor MUST 经 agent-service-protocol port 启动远程执行；握手失败 MUST fail-closed 且父 Run 收到可读错误。

#### Scenario: Remote builder handshake success

- **WHEN** Team Workflow 节点绑定 Cursor/Claude 兼容 Agent Package
- **THEN** 子 Run 经 protocol 启动且 builderId 写入 RunStore
- **AND** 父 emit 含 builderId 供 UI 展示

#### Scenario: Remote builder handshake failure

- **WHEN** protocol 握手返回 unsupported 或 auth 失败
- **THEN** 子 Run 不进入 MODEL 阶段
- **AND** 父 Run 收到 `code=builder_unavailable` summary

### Requirement: Sub-run stream events forwarded without breaking parent terminal

父 Executor MUST 将子 Run 的 progress/tool 事件映射为父 Run 的 orchestration 子事件；父 Run 仍 MUST 遵守单一 `run.completed|cancelled|failed` 终态约束。

#### Scenario: Child tool events appear in parent trace

- **WHEN** 子 Run 执行工具
- **THEN** 父 Run emit 含 `subRunId` 的 orchestration 摘要事件
- **AND** 父 Run MUST NOT 提前发送 `run.completed`

#### Scenario: Parent terminal after all children settled

- **WHEN** 所有子 Run 已达终态且父 Run 完成 PERSIST
- **THEN** 父 Run 发送唯一 terminal 事件
- **AND** 子 Run terminal 不替代父 terminal
