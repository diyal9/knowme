## Purpose

为 KnowMe Agent 提供跨 Skill、Workflow 与 Function Calling 共用的防幻觉运行时：结构化引用状态、证据/工具账本、fail-closed 输出门与 claim-evidence 校验，使外部事实与执行态只能来自可 provenance 的工具结果而非模型自述。

## ADDED Requirements

### Requirement: Structured reference state persists across turns

系统 MUST 维护会话级 ReferenceState，包含结构化 refs（id、kind、label、payload、可选 boundTool）与 pendingSelection（含 options 数组）。用户纯数字或指代选择 MUST 通过 ref id / option index 绑定，MUST NOT 依赖从自然语言气泡解析恢复候选。

#### Scenario: Numeric selection binds structured candidate

- **WHEN** 上一轮助手输出写入 pendingSelection（含至少 2 个 option，各带稳定 id 与 payload）
- **AND** 用户本轮仅发送「2」
- **THEN** runtime MUST 将选择绑定为 options[1]（1-based 或 0-based 由 schema 固定并文档化）
- **AND** 生成 deterministic tool intent（含 option.payload 中的定位字段）
- **AND** MUST NOT 因 prompt 过短而跳过 ReferenceState 解析

#### Scenario: Ambiguous numeric input without pending selection

- **WHEN** 用户发送纯数字且 ReferenceState 无 pendingSelection 或 activeRef
- **THEN** runtime MUST fail-closed：不得编造具体外部事实
- **AND** 助手输出 MUST 要求用户澄清或重新展示选项

#### Scenario: Task switch clears stale pending selection

- **WHEN** 用户切换 workflow/skill 或显式开始新任务
- **THEN** pendingSelection MUST 清空或标记 stale
- **AND** 旧 refs 不得自动作为新任务证据

### Requirement: Evidence ledger records provenance per run

每轮 Run MUST 维护只追加的 EvidenceLedger。每条 entry MUST 含：source（tool|context|user|system）、status（ok|fail|empty|truncated）、digest、provenance（tool 名、refId、callId 等）及可选 rawRef。

#### Scenario: Successful tool appends ok evidence

- **WHEN** 工具返回成功且正文非空
- **THEN** EvidenceLedger MUST 追加 status=ok 的 entry
- **AND** provenance MUST 指向该 tool call

#### Scenario: Truncated tool marks truncated evidence

- **WHEN** 工具结果被截断或低于质量阈值（如仅标题无正文）
- **THEN** entry status MUST 为 truncated 或 empty
- **AND** verifier MUST NOT 将 truncated/empty entry 作为具体事实依据

#### Scenario: Ledger survives thin user prompt

- **WHEN** 用户 prompt 仅含「2」或同等短指代
- **THEN** EvidenceLedger 与 ReferenceState 仍 MUST 参与 GROUND/VERIFY
- **AND** MUST NOT 因 prompt 长度跳过 ledger 更新

### Requirement: Tool ledger is authoritative for execution claims

「已读取」「已创建」「已发送」「已执行」等执行态声明 MUST 仅当 ToolLedger 存在对应 status=ok 的 call 时为真。模型与 prompt MUST NOT 单独赋予这些状态。

#### Scenario: Model claims read without tool call

- **WHEN** 最终助手文本含「已读取」或等价执行态
- **AND** ToolLedger 无对应 required tool 的 ok call
- **THEN** OutputGate MUST 拦截该输出
- **AND** 用户可见结果 MUST 为 honest pending/blocked 文案，不得保留虚假执行态

#### Scenario: Failed tool blocks success claims

- **WHEN** required tool call status=fail 或 empty
- **THEN** 助手 MUST NOT 输出成功读取/执行的具体事实摘要
- **AND** MUST 携带工具返回的真实失败原因（若可得）

### Requirement: Fail-closed output for ungrounded external facts

当 requiredTools 未调用、工具失败、结果 empty/truncated 或 requiredEvidence 未满足时，系统 MUST fail-closed：不得生成具体外部事实（日期、人名、议题、指标等），除非 EvidenceLedger 有 ok 且非 truncated 的 supporting entry。

#### Scenario: Missing required tool blocks factual summary

- **WHEN** Workflow 声明 requiredTools 含某 read tool
- **AND** 本轮 Run 未产生该 tool 的 ok call
- **THEN** 最终输出 MUST NOT 含该材料的具体议题/责任人/日期
- **AND** MUST 引导下一步（调用工具或澄清）

#### Scenario: Thin title-only body treated as insufficient

- **WHEN** 工具返回仅标题或包装字段无实质正文
- **THEN** ledger entry MUST NOT 视为 ok 正文证据
- **AND** OutputGate MUST 拒答具体事实或要求重新读取

### Requirement: Claim-evidence verifier with deterministic priority

系统 MUST 在最终输出前运行 ClaimVerifier：将 claims 与 EvidenceLedger/ToolLedger 对齐。Verifier MUST 优先使用确定性规则（L0/L1），MUST NOT 仅依赖当前 prompt 关键词或事后 NL 拦截。

#### Scenario: External fact requires supporting evidence id

- **WHEN** 输出含可解析的外部事实 claim（如「议题：…」「负责人：…」「日期：…」）
- **AND** 无 linked evidenceIds 或 supporting ledger entry
- **THEN** verifier MUST fail
- **AND** OutputGate MUST 阻止或改写该 claim

#### Scenario: Verified claims expose provenance metadata

- **WHEN** claim 通过 verifier
- **THEN** stream/metadata MUST 携带 evidenceIds 与 sources 供 UI 展示
- **AND** 不得隐藏来源仅展示结论

### Requirement: Multi-turn context boundaries

Runtime MUST 定义：纯数字/指代、重复 assistant 消息、任务切换、旧事实复用的边界；不得将 stale 或未验证 ledger 当作新 Run 的默认真相。

#### Scenario: Stale ref requires re-fetch or disclaimer

- **WHEN** 模型引用 stale ReferenceState 中的事实
- **AND** 无本轮 ok evidence
- **THEN** verifier MUST fail 或强制显式「未重新读取」disclaimer
- **AND** MUST NOT 静默复用旧事实为当前读取结果

#### Scenario: Tool budget respects required tools first

- **WHEN** Run 接近 tool 预算上限且存在 requiredTools 未满足
- **THEN** runtime MUST 优先调度 requiredTools
- **AND** optional auto-read MUST NOT 挤占 required 调用

### Requirement: Workflow completion from ledger not model assertion

Workflow 完成态 MUST 由 completionConditions 与 ledger 判定；模型在 plan/checklist 中标记 done MUST NOT 替代 required tool 或 evidence 满足。

#### Scenario: Plan marks done but ledger unmet

- **WHEN** 模型将 plan item 标为 done
- **AND** completionConditions 未满足
- **THEN** runtime MUST 保持 blocked/partial 状态
- **AND** 最终输出 MUST 诚实说明未完成原因
