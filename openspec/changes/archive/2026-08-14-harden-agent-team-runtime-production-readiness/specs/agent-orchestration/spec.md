## MODIFIED Requirements

### Requirement: Parallel sub-runs with budget

系统 MUST 支持有限并行（默认每 Run ≤1 并行子 Run）；并行 MUST 共享父 Run 取消信号。子 Run 的查询、取消、恢复和终态 MUST 以持久化 Run 生命周期权威为准，生产主进程不得维护第二套子 Run 状态 registry。

#### Scenario: Parallel cap

- **WHEN** 已有 1 个 running 子 Run 再请求并行
- **THEN** 第二个请求排队或返回 `parallel_cap`

#### Scenario: Parent cancel stops children

- **WHEN** 用户取消父 Run
- **THEN** 所有 active 子 Run MUST 在 3s 内取消

#### Scenario: Legacy root controller compatibility

- **WHEN** 单 Agent 根 Run 仍由现有 AbortController 执行且同时拥有权威 Run 记录
- **THEN** 取消 MUST 同时触发根 controller 与权威 RunManager
- **AND** 子 Run 状态 MUST NOT 从 legacy 内存 Map 推断

### Requirement: Sub-run registry eviction after terminal state

子 Run 元数据 MUST 由 RunManager/RunStore 的终态留存策略管理；查询已清理 id MUST 返回可读 `not_found` 文案。进程内 launcher 句柄、AbortController 和 waiter 只可作为可清理资源，不得成为生命周期查询的权威来源。

#### Scenario: Old sub-run id after restart

- **WHEN** 用户查询已 evict 的子 Run id
- **THEN** 返回「Run 已结束或已清理」类说明
- **AND** MUST NOT 抛未捕获异常

#### Scenario: Terminal state outlives launch handle

- **WHEN** 子 Run 已结束且 launcher 已释放活动句柄
- **THEN** 状态查询 MUST 仍从 RunStore 返回终态
- **AND** MUST NOT 返回由句柄缺失造成的 `not_found`
