## ADDED Requirements

### Requirement: spawnSubRun launches real isolated child runs

`spawnSubRun` MUST 通过 RunManager/Launcher 启动真实隔离子 Run（本地 `AgentRunExecutor` 或远程 Agent Service），MUST NOT 仅登记 subRunId 并返回假成功。每个子 Run MUST 拥有独立 `runId`、AbortSignal、工具面、Expert 快照与 append-only Run Event Log。

#### Scenario: Real executor child run completes

- **WHEN** 父 Run 调用 `delegate_to_expert` 且 RunManager 可用
- **THEN** 子 Run 进入真实 `PREPARE`→`DONE` 阶段序列
- **AND** 父 Run 收到的 summary 来自子 Run 终态与 message bus，而非占位文案

#### Scenario: Registration-only spawn is rejected in tests

- **WHEN** 集成测试注入仅返回 `{ ok: true, text: '已登记' }` 的 spawnSubRun
- **THEN** eval 或 smoke MUST fail
- **AND** 报告 MUST 指出 missing real executor phases

#### Scenario: Remote builder child run via agent service protocol

- **WHEN** 子 Run 绑定远程 Builder Agent Package
- **THEN** Launcher MUST 通过 agent-service-protocol 握手并启动隔离执行
- **AND** 子 Run 终态 MUST 映射为本地 `DONE`/`ERROR`/`CANCELLED`

### Requirement: await and status query for sub-runs

Orchestration MUST 提供 `await_sub_run(subRunId, timeoutMs?)` 与 `get_sub_run_status(subRunId)` 工具（或等价 orchestration port）；父 Run MUST 能在不阻塞 Renderer 的前提下等待一个或多个子 Run 终态。

#### Scenario: Await returns on child terminal

- **WHEN** 父 Run 调用 `await_sub_run` 且子 Run 在超时前达到 `DONE`
- **THEN** 工具返回 `ok=true` 与结构化 summary（含 terminal、durationMs、builderId）
- **AND** 父 Run trace 记录 await 步骤

#### Scenario: Await times out

- **WHEN** 子 Run 在 `timeoutMs` 内未达到终态
- **THEN** 返回 `ok=false, code=subrun_timeout`
- **AND** 父 Run MAY 选择 cancel 该子 Run 或继续等待（按 workflow 策略）

#### Scenario: Status query for running child

- **WHEN** 父 Run 调用 `get_sub_run_status` 且子 Run 仍在 `MODEL` 或 `TOOL`
- **THEN** 返回 `status=running`、当前 `phase`、已运行 `durationMs`
- **AND** MUST NOT 返回伪造 `completed`

#### Scenario: Status query after persist restart

- **WHEN** 应用重启后查询仍在 RunStore 中的子 Run id
- **THEN** `get_sub_run_status` MUST 从持久化事件重建状态
- **AND** 终态子 Run MUST 返回准确 terminal 与 stopReason

### Requirement: Agent message bus for handoff and terminal messages

Orchestration MUST 经 agent-message-bus 交换版本化 envelope：`handoff`、`status`、`artifact`、`evidence`、`approval.request`、`approval.result` 与 `terminal`；未知 `protocolVersion` MUST fail-closed。

#### Scenario: Handoff envelope accepted

- **WHEN** 父 Run 发送 handoff 含 `requirementId` 与 artifactRefs
- **THEN** 子 Run 首条 bus 消息 MUST 可见 handoff 摘要
- **AND** 父时间线展示 handoff 来源与目标 expert

#### Scenario: Terminal message aggregates to parent

- **WHEN** 子 Run 经 bus 发送 `terminal`（DONE/ERROR/CANCELLED）
- **THEN** 父 orchestration MUST 合并 summary 到父上下文
- **AND** MUST NOT 静默吞掉 ERROR 终态

#### Scenario: Unknown bus protocol version

- **WHEN** 收到不支持 `protocolVersion` 的 bus 消息
- **THEN** 子 Run MUST 以 `ERROR` 终止且 code=`protocol_unsupported`
- **AND** MUST NOT 继续执行工具

### Requirement: Parallel join and barrier aggregation

Orchestration MUST 支持有限并行子 Run（受 Expert/Team policy 约束）并在 barrier 点等待全部活跃子 Run 终态后再汇总；并行子 Run MUST 共享父 Run 取消信号。

#### Scenario: Parallel cap enforced

- **WHEN** 活跃并行子 Run 数已达 policy.maxParallel
- **THEN** 新并行请求 MUST 排队或返回 `parallel_cap`
- **AND** MUST NOT 启动超额真实 Executor

#### Scenario: Barrier waits for all children

- **WHEN** Team Workflow 节点声明 parallel join
- **AND** 两个子 Run 均已启动
- **THEN** 父 Run MUST 等待两者均达终态后再进入汇总
- **AND** 汇总结果 MUST 含每个 subRunId 的 terminal 与 summary

#### Scenario: One child fails at barrier

- **WHEN** parallel join 中任一子 Run 为 `ERROR`
- **THEN** 父 Run 收到结构化 error summary 列表
- **AND** workflow gate MAY 路由到打回/修复分支（若 Team Package 声明）

### Requirement: Cascade cancel through RunManager

父 Run 取消或 orchestration 预算耗尽时，RunManager MUST 级联取消所有 running 子 Run 与关联后台进程；`cancelSubRun` MUST 调用真实 abort 而不仅是内存 registry 更新。

#### Scenario: Parent cancel stops real executors

- **WHEN** 用户取消父 Run 且存在 running 子 Run
- **THEN** 每个子 Run MUST 在 ≤3s 内达 `CANCELLED`
- **AND** running 子 Executor 或远程 session MUST 收到 abort

#### Scenario: Cancel propagates to grandchild depth limit

- **WHEN** 父 cancel 且子 Run 仍持有 running 后台任务（如 remote poll）
- **THEN** RunManager MUST best-effort 终止该后台任务
- **AND** 单测/registry 中 running 计数 MUST 为 0

#### Scenario: Budget exhausted triggers cascade

- **WHEN** 父 Run LLM/工具预算耗尽且 policy 要求停止编排
- **THEN** orchestration MUST 调用 cancelSubRun 取消所有 running 子 Run
- **AND** 父 Run 进入可读 blocked/ERROR 终态

### Requirement: Sub-run retry and idempotent launch receipt

Orchestration MUST 支持按 Team/Workflow 策略对失败子 Run 有限重试；同一 `(parentRunId, nodeId, attemptKey)` 的重复 launch MUST 通过幂等收据返回已有 subRunId 而 MUST NOT 启动重复 Executor。

#### Scenario: Failed sub-run retried once

- **WHEN** 子 Run 以 `ERROR` 终止且 workflow 允许 retry=1
- **THEN** orchestration MAY 启动新 subRunId 并递增 attempt
- **AND** 父 trace MUST 关联原失败与新 attempt

#### Scenario: Duplicate launch returns same receipt

- **WHEN** 同一 attemptKey 在 60s 内重复调用 spawn
- **THEN** 返回已有 subRunId 与当前 status
- **AND** MUST NOT 创建第二个并行 Executor

### Requirement: Persisted run tree metadata in orchestration port

Orchestration port MUST 读写 RunStore 中的父子关系、builderId、expertId、phase、terminal 与 stopReason；内存 registry eviction MUST NOT 丢失可恢复 Run 树。

#### Scenario: Run tree survives restart

- **WHEN** 父 Run 含 running 子 Run 时应用崩溃并重启
- **THEN** RunManager MUST 从 RunStore 恢复 Run 树
- **AND** 用户 MAY 查询子 Run status 或触发 resume/cancel

#### Scenario: Evicted terminal metadata still queryable from store

- **WHEN** 内存 registry 已 evict 终态子 Run id
- **AND** RunStore 仍保留该 id 事件
- **THEN** `get_sub_run_status` MUST 返回终态与 stopReason
- **AND** MUST NOT 抛未捕获异常
