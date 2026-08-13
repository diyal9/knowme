## ADDED Requirements

### Requirement: Ground and verify evidence phases in run loop

执行内核 MUST 在 MODEL 产出用户可见最终文本前，进入证据相关阶段（GROUND 与 VERIFY_CLAIMS，或等价的 VERIFY 子阶段）：合并 tool results 到 EvidenceLedger、运行 ClaimVerifier 与 OutputGate。

#### Scenario: Final text blocked when verifier fails

- **WHEN** LLM 返回最终文本且 ClaimVerifier 失败
- **THEN** Run MUST NOT 将该文本作为 verified 最终答复 persist
- **AND** MUST 尝试一次 structured regen 或输出 honest refusal（按预算策略）

#### Scenario: Ground phase records truncated tools

- **WHEN** TOOL 阶段返回 truncated 结果
- **THEN** GROUND 阶段 MUST 写入 truncated ledger entry
- **AND** runPhases MUST 包含 GROUND（或等价可观测标识）

#### Scenario: Required tools checked before finalize

- **WHEN** ReferenceState.taskFrame 声明 requiredTools
- **AND** ToolLedger 未全部 ok
- **THEN** VERIFY 阶段 MUST fail-closed
- **AND** 终态为 DONE 时 MUST NOT 附带未验证的具体外部事实

### Requirement: Ports expose ledger and reference state

RunPorts MUST 提供 ReferenceState 读写、EvidenceLedger 追加、ToolLedger 查询接口；executor MUST NOT 在内核外隐式维护重复账本。

#### Scenario: Eval injects reference state port

- **WHEN** conversation eval fixture 注入 pendingSelection
- **THEN** executor 第一轮用户输入 MUST 可见该 ReferenceState
- **AND** 绑定逻辑不依赖 main.js 特判

## MODIFIED Requirements

### Requirement: Recovery and verify phases integrate existing modules

当工具失败、计划未完成或**证据/claim 未通过验证**时，内核 MUST 进入 `RECOVER` 或 `VERIFY` 阶段，并消费既有 recovery/verify 策略与**新增 ClaimVerifier/OutputGate**；行为对 C 端 MUST 表现为诚实 blocked/refusal，不得静默放行编造事实。

#### Scenario: Recoverable tool error triggers RECOVER

- **WHEN** 工具返回可恢复错误（如 network/timeout）
- **THEN** Run 进入 `RECOVER` 并按策略决定是否重试或进入反思轮

#### Scenario: Plan incomplete triggers VERIFY

- **WHEN** Run 存在 plan 且预算即将耗尽或模型请求收敛
- **THEN** Run 进入 `VERIFY` 并评估 plan 完成度
- **AND** 根据评估结果继续、扩展预算或 partial finalize

#### Scenario: Claim verify failure triggers blocked finalize

- **WHEN** ClaimVerifier 判定 requiredEvidence 未满足
- **THEN** Run 进入 VERIFY 且 MUST NOT 以 DONE+编造事实 结束
- **AND** emit 须含 grounding-status blocked/failed 元数据
