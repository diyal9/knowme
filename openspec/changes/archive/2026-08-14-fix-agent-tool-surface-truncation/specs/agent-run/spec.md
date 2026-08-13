## ADDED Requirements

### Requirement: Preflight failures converge the run to a terminal state

Run 在进入模型循环前的前置校验失败（如必需工具不可用、上下文装配失败）MUST 把 Run 收敛为终态并写入失败原因，MUST NOT 让 Run 停留在 `running`。

#### Scenario: Unavailable required tool ends the run

- **GIVEN** taskFrame 声明的必需工具在本轮工具面不可用
- **WHEN** 系统在模型调用前中止本轮
- **THEN** Run 状态为终态（failed）且记录失败原因
- **AND** Run 事件日志包含终态事件
