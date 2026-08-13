# agent-team-runtime Specification

## Purpose

为 KnowMe 提供持久化 Run 树、Scheduler、Launcher 与 RunManager 编排内核，使 `spawnSubRun` 启动真实隔离子 Run（本地 Executor 或远程 Agent Service），支持有限并行、等待汇聚、重试、取消、崩溃恢复与 per-Run 强制治理，替代登记式假成功占位。

## ADDED Requirements

### Requirement: Persistent run tree with parent-child links

RunManager MUST 为每次 Team 或委派执行维护持久化 Run 树；每个节点含 `runId`、`parentRunId`、`rootRunId`、`depth`、`agentPackageId`、`status`、`phase` 与 `children[]`；重启后 MUST 可从 RunStore 重建完整树。

#### Scenario: Sub-run linked to parent

- **WHEN** 父 Run 调用 `spawnSubRun` 成功
- **THEN** 子 Run 记录 parentRunId 与 depth=parent.depth+1
- **AND** 父 Run children 列表含该 subRunId

#### Scenario: Run tree survives restart

- **WHEN** Electron 在 Team Run 执行中崩溃并重启
- **THEN** RunManager MUST 从持久化事件重建 Run 树
- **AND** UI 可查询父子状态与最后已知 phase

### Requirement: Real isolated sub-run launch

`spawnSubRun` MUST 通过 Launcher 启动真实隔离 Executor 进程或远程 Agent Service 会话；MUST NOT 仅登记 runId 并返回假成功；子 Run MUST 拥有独立 AbortSignal、ToolLedger、EvidenceLedger 与 Expert 快照。

#### Scenario: Local executor sub-run starts

- **WHEN** 父 Run spawn 本地 Agent Package 子 Run
- **THEN** Launcher 启动隔离 Executor 并开始消费任务 envelope
- **AND** 子 Run status 由 `pending` 转为 `running` 且可观测 tool 事件

#### Scenario: Remote agent service sub-run starts

- **WHEN** 子 Agent 声明 remote builder 兼容
- **THEN** Launcher 经 Agent Service Protocol 握手并提交任务
- **AND** 远程终态 MUST 映射回本地 Run 树节点

#### Scenario: Registry-only spawn rejected

- **WHEN** 集成测试调用 spawnSubRun 且无 Executor/Service 响应
- **THEN** 子 Run 终态 MUST 为 `ERROR`
- **AND** MUST NOT 返回 status=running 且无后续事件

### Requirement: Scheduler with parallelism and join

Scheduler MUST 按 Team Workflow DAG 调度节点；默认每父 Run 并行子 Run ≤1（可配置）；join 节点 MUST 等待全部前置 succeeded 或按 joinStrategy 处理 partial failure；超预算排队或返回 `parallel_cap`。

#### Scenario: Parallel cap enforced

- **WHEN** 已有 1 个 running 子 Run 且 parallelism=1
- **THEN** 第二个并行 spawn MUST 排队或返回 `parallel_cap`
- **AND** MUST NOT 超出配置并行上限

#### Scenario: Join waits for all predecessors

- **WHEN** DAG 节点 E 依赖并行 C 与 D
- **THEN** Scheduler MUST 在 C 与 D 均终态后才启动 E
- **AND** 若任一为 ERROR 且 joinStrategy=allSucceeded 则 E MUST NOT 启动

### Requirement: Cancel propagation within three seconds

父 Run 或 Team 根 Run 取消 MUST 向所有 active 子 Run 与后台进程传播 AbortSignal；orchestration MUST 调用 `cancelSubRun(subRunId)`；所有子 Run MUST 在 **≤3s** 内达到 `CANCELLED` 终态。

#### Scenario: Parent cancel stops children

- **WHEN** 用户取消父 Run 且存在 2 个 running 子 Run
- **THEN** 两子 Run 均在 3s 内终态为 `CANCELLED`
- **AND** MUST NOT 遗留 running 后台进程

#### Scenario: Team root cancel drains tree

- **WHEN** 用户取消 Team 根 Run
- **THEN** 整棵 Run 树 active 节点 MUST 全部取消
- **AND** 取消后 MUST NOT 发起新 LLM 或工具调用

### Requirement: Retry recovery and safe resume

RunManager MUST 支持节点级 retry（maxAttempts、backoff）；崩溃恢复 MUST 从最后 checkpoint 安全 resume 或显式 fail；resume MUST 幂等且 MUST NOT 重复已提交副作用；无法安全 resume 时 MUST fail-closed 并暴露恢复控制。

#### Scenario: Retry after transient sub-run error

- **WHEN** 子 Run 因 network/timeout 以 ERROR 终止且 retry 预算未耗尽
- **THEN** Scheduler MAY 按 backoff 重试该节点
- **AND** 新 attempt MUST 获得新 subRunId 或等价 attempt 标识

#### Scenario: Resume from checkpoint

- **WHEN** 父 Run 在 ORCHESTRATE 阶段崩溃且存在有效 checkpoint
- **THEN** 恢复后 MUST 从 checkpoint 继续而非重放已完成子 Run
- **AND** 已提交 Artifact MUST NOT 重复写入

#### Scenario: Unsafe resume blocked

- **WHEN** checkpoint 与 Event Log 不一致或缺少幂等收据
- **THEN** 系统 MUST NOT 自动 resume
- **AND** 向用户返回可读 `resume_unsafe` 与手动选项

### Requirement: Per-run mandatory governance envelope

每个父/子 Run 启动前 RunManager MUST 装配强制治理 envelope：tool allowlist、Expert 快照、Connector 授权、沙箱路径、token/工具预算、超时、draft 审批策略；未授权工具、未审批副作用、无证据外部事实 MUST fail-closed。

#### Scenario: Unauthorized tool blocked

- **WHEN** 子 Run 调用不在 allowlist 的工具
- **THEN** 工具 MUST 被拒绝并返回 `tool_not_allowed`
- **AND** Run MUST NOT 将结果记为 verified 证据

#### Scenario: Unapproved write blocked

- **WHEN** 工具返回 requiresApproval=true 且用户未批准
- **THEN** Run MUST 暂停于 pending_review
- **AND** plan/verify MUST NOT 将外部写标记为 done

#### Scenario: Ungrounded external fact blocked

- **WHEN** 子 Run 输出含具体外部事实且 EvidenceLedger 无 required 证据
- **THEN** 终态 MUST NOT 为 verified DONE
- **AND** 父 Run 汇总 MUST 上浮 blocked/refusal 摘要

### Requirement: Orchestration depth and sub-expert allowlist

RunManager MUST 强制 maxDepth（默认 2）；子 Run MUST NOT 再次 spawn 超过深度；Expert orchestration policy 的 `allowedSubExperts` 非空时 MUST 限制可 spawn 的 agentPackageId/expertId。

#### Scenario: Depth limit exceeded

- **WHEN** 子 Run depth 已达 maxDepth 并尝试 spawnSubRun
- **THEN** 返回 `orchestration_depth_exceeded`
- **AND** MUST NOT 创建孙 Run

#### Scenario: Sub-expert not in allowlist

- **WHEN** 父 Expert allowedSubExperts 不含目标 agentPackageId
- **THEN** spawnSubRun MUST 被拒绝
- **AND** 返回可读 allowlist 违规错误
