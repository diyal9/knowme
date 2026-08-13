## Purpose

为 Agent Run 提供 deterministic mock-replay 评估框架与首批代表性用例，使团队可在无真实 LLM/网络/MCP 的情况下测量阶段序列、工具次数与收敛行为，并作为回归硬门禁。

## ADDED Requirements

### Requirement: Fixture-driven mock replay

Eval harness MUST 支持 JSON（或等价）fixture 定义：输入 payload、LLM 响应脚本（可多轮）、工具结果脚本、期望终态与指标。Harness MUST 注入 mock ports 驱动 `AgentRunExecutor` 或等价入口，MUST NOT 调用真实 API。

#### Scenario: Replay simple chat fixture

- **WHEN** 加载 `chat-simple` fixture 且 LLM 脚本仅含一条文本响应
- **THEN** Eval 通过且终态为 `DONE`
- **AND** `toolCalls === 0`

#### Scenario: Replay multi-round tool fixture

- **WHEN** fixture 的 LLM 脚本含 tool_calls 且 tool 脚本返回成功
- **THEN** Eval 断言 `toolCalls` 与期望一致
- **AND** 阶段序列包含 `TOOL`

### Requirement: Representative baseline scenarios

首批 Eval 用例 MUST 至少覆盖以下场景各 1 例：`chat`（无工具）、知识/检索工具、工具失败恢复、计划未完成 partial finalize、grounding 上下文注入、用户取消、不可恢复错误。

#### Scenario: Knowledge tool scenario

- **WHEN** 运行 knowledge/retrieval 类 fixture
- **THEN** 期望阶段包含 `CONTEXT`
- **AND** 至少一次工具或检索相关阶段被记录

#### Scenario: Tool recovery scenario

- **WHEN** fixture 首次工具失败且 recovery 策略允许重试
- **THEN** Eval 断言出现 `RECOVER`
- **AND** 最终 `DONE` 或符合 fixture 的 `ERROR`/`partial` 期望

#### Scenario: Plan incomplete scenario

- **WHEN** fixture 含未完成 plan 且预算耗尽
- **THEN** Eval 断言 `VERIFY` 阶段存在
- **AND** 终态与 partial finalize 期望一致

#### Scenario: Cancel scenario

- **WHEN** fixture 在 MODEL 阶段触发 abort
- **THEN** 终态为 `CANCELLED`
- **AND** 无额外 LLM 调用

### Requirement: Structured eval report output

Harness MUST 输出结构化报告，至少包含：`name`、`passed`、`terminal`、`runPhases`、`rounds`、`toolCalls`、`planEval`（若有）、`durationMs`、`error`（若失败）。报告 MUST 可被 `npm test` 消费或写入 evidence 路径。

#### Scenario: Failed eval surfaces diff

- **WHEN** 实际 `runPhases` 与 fixture `expect.phases` 不一致
- **THEN** 测试失败并打印 expected vs actual 差异

### Requirement: CI runs without real API

Agent Eval 用例 MUST 纳入 `npm test` 硬门禁；CI 执行 Eval MUST NOT 要求 API Key、外网 LLM 或飞书/MCP 连通性。

#### Scenario: Offline test suite green

- **WHEN** 在无 `OPENAI_API_KEY` 等密钥的环境运行 `npm test`
- **THEN** agent eval 用例仍全部通过

### Requirement: Metrics regression baseline

项目 MUST 维护可版本化的 eval 基线（fixture 集合）；修改 executor 逻辑导致 expect 变化时，MUST 显式更新 fixture 并在 code-review 中说明行为变更意图。

#### Scenario: Intentional behavior change updates fixture

- **WHEN** 开发 deliberately 改变阶段顺序或 tool 计数逻辑
- **THEN** 相应 fixture `expect` 在同 PR 中更新
- **AND** tasks/code-review 记录变更原因
