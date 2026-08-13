## ADDED Requirements

### Requirement: ai-cancel-run propagates to orchestration sub-runs

当用户或系统取消父 Agent Run 时，`ai-cancel-run`（或等价 cancel 端口）MUST 取消所有关联 orchestration 子 Run。实现 MUST 向 orchestration 层传入可用的 `cancelSubRun(subRunId)` 并在 **≤3s** 内使子 Run 达到 `CANCELLED` 终态。

#### Scenario: Parent cancel stops child runs

- **WHEN** 父 Run 处于 ORCHESTRATE 阶段且存在 running 子 Run
- **AND** 用户触发 `ai-cancel-run`
- **THEN** 所有子 Run 终态为 `CANCELLED`
- **AND** MUST NOT 遗留 running 子 Run 超过 3s

#### Scenario: Cancel stops budget consumption

- **WHEN** 父 Run 已 CANCELLED
- **THEN** 子 Run MUST NOT 继续消耗 LLM 或工具预算

#### Scenario: Electron E2E cancel no leak

- **WHEN** Electron smoke 触发 delegate 后立即 cancel
- **THEN** trace 中子 Run 步骤显示 cancelled
- **AND** 无新增 tool 调用事件

## MODIFIED Requirements

### Requirement: Cancelled run terminal state

Run 收到 abort/cancel 信号且当前阶段允许中断时，终态 MUST 为 `CANCELLED`；MUST NOT 再发起 LLM 或工具调用；MUST 取消所有关联子 Run 与后台进程（best-effort ≤3s）。

#### Scenario: Cancelled run stops children

- **WHEN** Run 收到 cancel 且存在 running 子 Run 或后台进程
- **THEN** 终态为 `CANCELLED`
- **AND** 子 Run 与进程在 3s 内停止

#### Scenario: No new work after cancel

- **WHEN** Run 已 CANCELLED
- **THEN** MUST NOT 发起新的 LLM 或工具调用
