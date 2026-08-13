## ADDED Requirements

### Requirement: cancelSubRun must be wired from run executor

orchestration 模块 MUST 接受 `cancelSubRun(subRunId)` 回调；当父 Run 取消或 orchestration 预算耗尽时 MUST 对所有 running 子 Run 调用该回调。

#### Scenario: cancelSubRun invoked on parent abort

- **WHEN** 父 Run abort 且子 Run 列表含 status=running
- **THEN** 每个 running 子 Run MUST 收到 cancelSubRun 调用
- **AND** 子 Run status 更新为 cancelled

#### Scenario: Sub-run leak detection in tests

- **WHEN** 单测模拟父 cancel 后检查子 Run registry
- **THEN** running 计数 MUST 为 0

### Requirement: Sub-run registry eviction after terminal state

orchestration 子 Run 元数据 MUST 在终态（DONE/CANCELLED/ERROR）后按 TTL（默认 1h）与容量上限（默认 100）evict；查询过期 id MUST 返回可读 `not_found` 文案。

#### Scenario: Old sub-run id after restart

- **WHEN** 用户查询已 evict 的子 Run id
- **THEN** 返回「Run 已结束或已清理」类说明
- **AND** MUST NOT 抛未捕获异常
