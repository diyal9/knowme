## Purpose

定义 Agent Team Runtime 在进程中断、持久化损坏、远程后端故障和资源压力下的生产行为，并提供可自动判定且不伪造外部可用性的结构化证据与指标。

## ADDED Requirements

### Requirement: Corruption-aware recovery
系统 MUST 验证 Run 事件的序列连续性、hash chain 和 state/event 一致性。截断的最后一行 MAY 被安全忽略；中段损坏、hash 不匹配或无法证明一致性的 state MUST fail-closed。

#### Scenario: Truncated final event is recoverable
- **WHEN** 进程在写入最后一行 event 时中断且此前 hash chain 完整
- **THEN** 恢复 MUST 使用最后一个完整 event
- **AND** 结果 MUST 标记 `tailTruncated=true`

#### Scenario: Middle event tampering is blocked
- **WHEN** event 中段 JSON、seq、prevHash 或 recordHash 被篡改
- **THEN** 自动恢复 MUST 返回 `event_log_corrupt`
- **AND** MUST NOT 静默跳过损坏事件继续运行

### Requirement: Deterministic fault and chaos gate
离线硬门禁 MUST 确定性覆盖重复 terminal/callback、损坏 state/event、进程中断、网络超时/断连、取消风暴、幂等副作用与资源泄漏，且 MUST 不依赖真实密钥或外网。

#### Scenario: Duplicate terminal callback
- **WHEN** 同一 Run 的 backend 连续或并发提交多个 terminal callback
- **THEN** 只有首个终态可提交
- **AND** duplicate terminal metric MUST 增加且 waiter 只解析一次

#### Scenario: Cancel storm
- **WHEN** 多个调用方并发取消同一父子 Run 树
- **THEN** 所有调用 MUST 收敛到同一终态
- **AND** 活动 launch、waiter、timer 与子进程泄漏计数 MUST 为 0

### Requirement: Remote backend readiness and failure semantics
远程后端 readiness MUST 执行有超时的协议握手和必要 capability 检查，而不是只判断 client 对象存在；超时、断连和 capability 缺失 MUST 返回稳定的结构化错误。

#### Scenario: Readiness handshake succeeds
- **WHEN** 后端在预算内完成兼容握手且提供 execute/status/cancel 能力
- **THEN** readiness 返回 `READY`
- **AND** 包含 negotiated protocol 与 capability 列表

#### Scenario: Network timeout is not success
- **WHEN** 后端握手或执行超过 deadline
- **THEN** 系统 MUST 返回 `remote_timeout`
- **AND** MUST NOT 创建登记式成功或伪造 terminal

### Requirement: Honest live evidence
Live E2E MUST 输出 `PASS`、`FAIL`、`BLOCKED` 或 `ADVISORY` 结构化状态。缺 token、服务、可用 Package 或特定能力时 MUST 使用 `BLOCKED`/`ADVISORY`，并输出缺失条件与可复跑命令。

#### Scenario: Missing live token
- **WHEN** live harness 未发现所需 token
- **THEN** 报告总体状态 MUST 为 `BLOCKED`
- **AND** 报告 MUST 包含 token 条件和无秘密的重跑命令

#### Scenario: Hermetic gate remains hard
- **WHEN** live 环境被阻塞但 loopback 契约完整
- **THEN** hermetic 成功/失败/澄清/取消/恢复场景 MUST 继续作为硬门禁执行
- **AND** live blocked MUST NOT 被改写为 PASS

### Requirement: Runtime production metrics
系统 MUST 提供结构化、无秘密的最小指标快照，至少包含队列深度、活动 Run/launch/waiter、取消次数与延迟、恢复结果、重复终态、资源泄漏、协议拒绝和信任拒绝。

#### Scenario: Metrics after recovery and cancel
- **WHEN** 执行一次 interrupted recovery 和一次取消
- **THEN** 指标快照 MUST 反映恢复结果与取消延迟
- **AND** 指标不得包含 prompt、token、authorization 或完整 tool args
