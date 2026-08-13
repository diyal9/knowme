# agent-run-executor Specification

## Purpose
提供可注入依赖、显式阶段状态机的 Agent Run 执行内核，使 `ai-generate` 核心循环可在主进程外独立测试与渐进迁移，而不改变 C 端对话契约。
## Requirements
### Requirement: Explicit run phase state machine

执行内核 MUST 在每次 Run 中维护显式阶段状态，至少包含：`PREPARE`、`CONTEXT`、`MODEL`、`TOOL`、`RECOVER`、`VERIFY`、`FINALIZE`、`PERSIST`、`DONE`、`ERROR`、`CANCELLED`。阶段进入与离开 MUST 记录到 Run 指标（如 `runPhases` 序列）。

#### Scenario: Normal chat completes with ordered phases

- **WHEN** 用户发起无工具调用的 chat tier Run 且 LLM 直接返回文本
- **THEN** Run 终态为 `DONE`
- **AND** `runPhases` 包含 `PREPARE`、`CONTEXT`、`MODEL`、`PERSIST`、`DONE` 且顺序合法

#### Scenario: Tool loop transitions MODEL and TOOL

- **WHEN** LLM 返回 tool_calls 且工具执行成功
- **THEN** Run 在 `MODEL` 与 `TOOL` 之间交替直至模型返回最终文本
- **AND** 每次 `TOOL` 阶段计入 tool 执行指标

#### Scenario: Cancelled run terminal state

- **WHEN** Run 收到 abort/cancel 信号且当前阶段允许中断
- **THEN** 终态为 `CANCELLED`
- **AND** 不再发起新的 LLM 或工具调用

#### Scenario: Unhandled failure maps to ERROR

- **WHEN** 端口依赖抛出未恢复异常或 settings 校验失败
- **THEN** 终态为 `ERROR`
- **AND** 返回可读错误信息，不静默崩溃

### Requirement: Injectable ports for LLM tools and context

执行内核 MUST 通过端口（ports）访问 LLM、工具执行、上下文构建、会话持久化与设置；MUST NOT 在内核内直接调用全局 `fetch` 或读写 `%APPDATA%` 路径。

#### Scenario: Mock LLM in unit test

- **WHEN** 测试注入返回固定文本的 mock LLM 端口
- **THEN** Run 可在无网络环境下完成并返回该文本

#### Scenario: Mock tool executor in unit test

- **WHEN** 测试注入按 fixture 返回结果的 mock 工具端口
- **THEN** 工具阶段结果与 fixture 一致且计入 trace

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

### Requirement: Stream events remain compatible

内核 MUST 通过注入的 `emit` 回调发出与现有 `ai-stream-event` 兼容的 stage/tool/stream/error/cancelled 事件；C 端时间线 MUST NOT 因内核抽离而缺失阶段更新。

#### Scenario: Stage events still emitted

- **WHEN** Run 进入 `PREPARE` 或 `CONTEXT`
- **THEN** `emit` 收到与既有 stage id 等价的 stage 事件（如 `stage_prepare`）

### Requirement: Legacy fallback flag

系统 MUST 支持通过环境变量或等价配置在 legacy 内联循环与内核 executor 之间切换；默认策略由实现阶段文档化，且 MUST 可在不 reinstall 的情况下回滚。

#### Scenario: Legacy path selected

- **WHEN** 配置为 legacy 模式
- **THEN** `ai-generate` 使用迁移前内联实现路径
- **AND** 用户可见行为与升级前一致

#### Scenario: Kernel path selected

- **WHEN** 配置为 kernel 模式
- **THEN** `ai-generate` 委托 `AgentRunExecutor`
- **AND** IPC 契约（payload/返回值/runId/cancel）不变

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

### Requirement: Orchestration phase in run state machine

AgentRunExecutor MUST 支持阶段 `ORCHESTRATE`（子 Run 创建、等待、汇总）；阶段转换 MUST 写入 trace 与 metrics。

#### Scenario: Delegate enters orchestrate

- **WHEN** 父 Run 调用 delegate_to_expert
- **THEN** runPhases 含 ORCHESTRATE
- **AND** emit 事件含 subRunId

### Requirement: Cancel propagates to child runs

父 Run 取消 MUST 取消所有关联子 Run 与后台进程 registry 条目。

#### Scenario: Cancel parent

- **WHEN** signal.aborted 在父 Run
- **THEN** 活跃子 Run 收到 abort 且 terminal=CANCELLED

### Requirement: Tool loop respects approval gate

当工具 handler 返回 `requiresApproval=true` 时，Executor MUST 将工具步骤标记为 pending_review，MUST NOT 在同一轮将写操作视为已完成证据。

#### Scenario: Draft does not count as done write

- **WHEN** feishu.draft_* 返回 draftId
- **THEN** plan/verify 阶段 MUST NOT 将外部写标记为 done
- **AND** 等待用户 approve 后才可记 applied 证据

### Requirement: ai-cancel-run propagates to orchestration sub-runs

当用户或系统取消父 Agent Run 时，`ai-cancel-run`（或等价 cancel 端口）MUST 取消所有关联 orchestration 子 Run。实现 MUST 向 orchestration 层传入可用的 `cancelSubRun(subRunId)` 并在 **≤3s** 内使子 Run 达到 `CANCELLED` 终态。

#### Scenario: Parent cancel stops child runs

- **WHEN** 父 Run 处于 ORCHESTRATE 阶段且存在 running 子 Run
- **AND** 用户触发 `ai-cancel-run`
- **THEN** 所有子 Run 终态为 `CANCELLED`
- **AND** MUST NOT 遗留 running 子 Run 超过 3s

#### Scenario: Cancel stops budget consumption

- **WHEN** 父 Run 已 CANCELLED
- **THEN** 子 Run MUST NOT 继续消耗 LLM 或工具预算

#### Scenario: Electron E2E cancel no leak

- **WHEN** Electron smoke 触发 delegate 后立即 cancel
- **THEN** trace 中子 Run 步骤显示 cancelled
- **AND** 无新增 tool 调用事件

### Requirement: Cancelled run terminal state

Run 收到 abort/cancel 信号且当前阶段允许中断时，终态 MUST 为 `CANCELLED`；MUST NOT 再发起 LLM 或工具调用；MUST 取消所有关联子 Run 与后台进程（best-effort ≤3s）。

#### Scenario: Cancelled run stops children

- **WHEN** Run 收到 cancel 且存在 running 子 Run 或后台进程
- **THEN** 终态为 `CANCELLED`
- **AND** 子 Run 与进程在 3s 内停止

#### Scenario: No new work after cancel

- **WHEN** Run 已 CANCELLED
- **THEN** MUST NOT 发起新的 LLM 或工具调用

### Requirement: Tool-capable model prose stays buffered

执行内核 MUST 将工具可用模型轮的正文保存在 Run 内缓冲中，直到该轮完成并确认没有工具调用且计划可交付；包含工具调用、需要恢复或需要继续计划的轮次 MUST NOT 提交最终回答。

#### Scenario: Model returns prose and tool calls

- **WHEN** 同一模型轮返回临时 prose 与一个或多个工具调用
- **THEN** 内核执行工具并只发送 progress/tool 事件
- **AND** 临时 prose 不产生 answer commit

#### Scenario: Plan remains incomplete without tool calls

- **WHEN** 模型轮没有工具调用但计划评估要求继续
- **THEN** 该轮正文继续留在缓冲或被下一轮替代
- **AND** Renderer 不收到可见最终回答

#### Scenario: Direct answer is deliverable

- **WHEN** 模型轮没有工具调用、计划完成且无需再生成
- **THEN** 该轮正文成为 canonicalization candidate

### Requirement: Canonicalization precedes answer commit

执行内核 MUST 在提交 answer 前依次完成产品后处理、grounding ledger 合并、声明验证、输出门禁、必要再生成、输出规范化与结构化 UI 提取；任何步骤产生的修订 MUST 只作用于缓冲 candidate。

#### Scenario: Grounding requests regeneration

- **WHEN** candidate 未通过声明验证且允许再生成
- **THEN** 再生成正文替代缓冲 candidate
- **AND** 被拒绝的 candidate 从未进入 answer lane

#### Scenario: Output gate blocks candidate

- **WHEN** 输出门禁最终阻断回答
- **THEN** canonical answer 为门禁提供的可读拒绝文本
- **AND** 原始未验证正文不向 Renderer 提交

#### Scenario: Suggestion is extracted

- **WHEN** canonical candidate 尾部包含合法 suggestion
- **THEN** answer commit 只含移除 suggestion 后的 Markdown
- **AND** 结构化选择通过 ui lane 单独发送

### Requirement: Persisted answer matches committed answer

持久化到会话的 assistant text MUST 与 `answer.committed` 的 canonical text 和 hash 一致；invoke 返回的完成结果 MUST NOT携带另一个可覆盖 Renderer 的正文版本。

#### Scenario: Run persists successfully

- **WHEN** canonical answer 与结构化 UI 已提交
- **THEN** 会话保存相同正文、hash、protocolVersion、trace 与可选 ui

#### Scenario: Renderer receives invoke result

- **WHEN** `ai-generate` Promise 在 terminal 事件后返回
- **THEN** 结果只用于确认 runId、terminal、sessionId 与公开 metrics
- **AND** Renderer 不用返回正文覆盖消息状态

### Requirement: Executor emits one ordered protocol stream

执行内核 MUST 为每个 Run 分配严格单调事件序号并最终发出一个 terminal 事件；取消、错误和成功结果 MUST 都能安全跨越 Electron IPC。

#### Scenario: Run succeeds

- **WHEN** 持久化完成
- **THEN** 内核在 answer/ui 事件之后发送一个 `run.completed`

#### Scenario: Run fails before answer commit

- **WHEN** 上下文、模型、工具或持久化出现不可恢复错误
- **THEN** 内核发送一个 `run.failed`
- **AND** 不再发送 answer 或普通进度事件

#### Scenario: Run is cancelled

- **WHEN** AbortSignal 在任一可中断阶段触发
- **THEN** 内核发送一个 `run.cancelled`
- **AND** 返回值不包含 ports、函数、AbortSignal 或不可克隆内部对象

