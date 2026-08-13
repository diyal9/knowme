## ADDED Requirements

### Requirement: Cross-builder team workflow fixtures

Eval harness MUST 提供至少 1 个 Team Workflow fixture：含两个不同 `builderId` 的 Agent 节点、串行 handoff 与 parallel join；Harness MUST mock agent-service-protocol 端口而 MUST NOT 调用真实远程 Builder。

#### Scenario: Two builders complete serial handoff

- **WHEN** 运行 `team-cross-builder-serial` fixture
- **THEN** eval 断言子 Run A（builder=cursor）完成后 bus handoff 至子 Run B（builder=claude）
- **AND** 父 Run 终态为 `DONE`

#### Scenario: Parallel join waits for both builders

- **WHEN** fixture 启动两个并行子 Run 且均在 mock 脚本内 DONE
- **THEN** eval 断言 barrier 后父 Run 收到双 summary
- **AND** `runPhases` 含 `ORCHESTRATE`

### Requirement: Real sub-run executor integration fixtures

Harness MUST 包含真实父子 Executor 集成 fixture（非登记式 spawnSubRun）：断言子 Run 独立 `runId`、阶段序列与 RunStore 事件条数。

#### Scenario: Fake spawn rejected by eval

- **WHEN** fixture 注入仅登记 subRunId 的 spawnSubRun
- **THEN** eval MUST fail
- **AND** failReasons 含 `fake_subrun_spawn`

#### Scenario: Child executor phases recorded

- **WHEN** 运行 `orchestration-real-child` fixture
- **THEN** 报告含 child `runPhases` 与 parent `ORCHESTRATE`
- **AND** child terminal 为 `DONE`

### Requirement: Await status and message bus fixtures

Eval MUST 覆盖 `await_sub_run` 成功、timeout 与 `get_sub_run_status` running/terminal；以及 bus `handoff`→`terminal` 消息链。

#### Scenario: Await success

- **WHEN** mock 子 Run 在 await 窗口内 DONE
- **THEN** eval 断言 await 工具 ok=true 且 summary 非空

#### Scenario: Await timeout

- **WHEN** mock 子 Run 不终止直至 timeout
- **THEN** eval 断言 `code=subrun_timeout`
- **AND** 可选策略触发 cancel 断言

#### Scenario: Bus handoff visible in metrics

- **WHEN** fixture 发送 handoff 含 requirementId
- **THEN** 报告 metrics 含 handoffCount≥1
- **AND** dimensions.contextContinuity 按期望通过或失败

### Requirement: Cascade cancel and no-leak fixtures

Eval MUST 断言父 cancel 后 ≤3s 内所有子 Run `CANCELLED` 且无新增 tool/LLM 调用；纳入 `npm test` 硬门禁。

#### Scenario: Parent abort during orchestrate

- **WHEN** fixture 在子 Run MODEL 阶段触发 abort
- **THEN** 父与子终态均为 `CANCELLED`
- **AND** `toolCalls` 在 abort 后不再增加

#### Scenario: Running leak count zero

- **WHEN** cancel 完成后检查 orchestration registry
- **THEN** running 计数 MUST 为 0

### Requirement: Recovery and crash-restart fixtures

Harness MUST 模拟 RunStore checkpoint 后重启：父 Run 可查询子 Run status、resume 或 cancel； MUST NOT 依赖真实进程 crash。

#### Scenario: Resume after simulated restart

- **WHEN** fixture 在子 Run running 时注入 restart 并 reload RunStore
- **THEN** `get_sub_run_status` 返回 running 或准确 terminal
- **AND** resume 路径按 fixture 期望 DONE 或 CANCELLED

### Requirement: Approval and security fail-closed fixtures

Eval MUST 覆盖：未批准写操作、未知 bus/output protocolVersion、未授权工具与无证据外部事实；均为 hard fail。

#### Scenario: Unapproved write fails verify

- **WHEN** 子 Run 产生 pending_review draft 且 fixture 期望 fail-closed
- **THEN** overall passed MUST 为 false
- **AND** refusalWhenUnmet 或 factFaithfulness MUST fail

#### Scenario: Unknown protocol version

- **WHEN** mock bus 发送 unsupported protocolVersion
- **THEN** 子 Run terminal MUST 为 ERROR
- **AND** eval MUST fail with `protocol_unsupported`

#### Scenario: Unauthorized tool in child run

- **WHEN** 子 Run policy 不含某 write 工具但 llmScript 尝试调用
- **THEN** toolChoice MUST fail
- **AND** MUST NOT 产生 applied audit

### Requirement: Run tree metrics in eval report

结构化报告 MUST 新增：`subRuns[]`（runId、builderId、expertId、terminal、durationMs）、`handoffCount`、`cancelCascadeMs`、`idempotentReceiptHits`；JSON MUST 可被 harness gate 解析。

#### Scenario: Report lists child runs

- **WHEN** 运行 multi-agent fixture
- **THEN** eval-report.json 含 subRuns 数组长度与 fixture 期望一致
- **AND** Markdown 报告打印 builderId 列

#### Scenario: Cancel cascade timing asserted

- **WHEN** cancel fixture 完成
- **THEN** 报告 `cancelCascadeMs` ≤ 3000
- **AND** 超阈值 MUST 导致 hard fail

### Requirement: Electron and daemon E2E evidence hooks

Harness MUST 暴露 npm script 或 evidence 脚本入口，用于 Electron/Daemon E2E：跨 Builder Team Workflow、取消无泄漏、Run 树 UI smoke；hard gate 仍 MUST NOT 依赖外网。

#### Scenario: Offline unit gate excludes E2E

- **WHEN** 无密钥环境运行 `npm test`
- **THEN** cross-builder 与 cancel 单元/集成 fixture 通过
- **AND** E2E 脚本 MAY 仅在有 DISPLAY/CI job 时运行

#### Scenario: Evidence script produces gate json

- **WHEN** 以 `--out openspec/changes/agent-package-and-team-runtime/evidence/` 运行 E2E hook
- **THEN** 生成可解析 gate json 含 runTreeRendered 与 cancelNoLeak 布尔值
