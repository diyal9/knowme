## Purpose

提供可注入依赖、显式阶段状态机的 Agent Run 执行内核，使 `ai-generate` 核心循环可在主进程外独立测试与渐进迁移，而不改变 C 端对话契约。

## ADDED Requirements

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

当工具失败或计划未完成时，内核 MUST 进入 `RECOVER` 或 `VERIFY` 阶段，并消费既有 recovery/verify 策略（重试、反思、plan 完成度评估），行为与迁移前等价。

#### Scenario: Recoverable tool error triggers RECOVER

- **WHEN** 工具返回可恢复错误（如 network/timeout）
- **THEN** Run 进入 `RECOVER` 并按策略决定是否重试或进入反思轮

#### Scenario: Plan incomplete triggers VERIFY

- **WHEN** Run 存在 plan 且预算即将耗尽或模型请求收敛
- **THEN** Run 进入 `VERIFY` 并评估 plan 完成度
- **AND** 根据评估结果继续、扩展预算或 partial finalize

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
