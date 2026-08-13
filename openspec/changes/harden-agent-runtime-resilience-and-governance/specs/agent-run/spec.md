## ADDED Requirements

### Requirement: Run 状态必须由单一权威源提供

运行管理 MUST 以单一状态权威源对外提供查询、取消、恢复和重试语义，不得依赖并行 legacy 状态路径作为主判定依据。

#### Scenario: 查询运行状态

- **WHEN** 用户或系统查询某个 run 的当前状态
- **THEN** 返回结果来自统一状态权威并可追溯

### Requirement: Team 级预算必须支持熔断守卫

运行调度 SHALL 支持 Team 或 Workspace 维度预算阈值，并在超限时触发熔断或降级策略。

#### Scenario: Team 预算超限

- **WHEN** Team 级预算累计超过阈值
- **THEN** 系统阻断新的高成本调度并记录熔断事件
