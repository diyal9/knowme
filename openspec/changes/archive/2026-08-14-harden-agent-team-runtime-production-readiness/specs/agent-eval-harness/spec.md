## ADDED Requirements

### Requirement: Runtime fault matrix hard gate
Eval harness MUST 提供不依赖真实 LLM/网络的 runtime fault matrix，确定性验证终态幂等、持久化损坏、进程中断、网络超时/断连、取消风暴、副作用收据和资源清理。

#### Scenario: Offline fault matrix
- **WHEN** 在无 API Key、无 Daemon 的环境执行 runtime production gate
- **THEN** 所有 hermetic fault 场景 MUST 执行
- **AND** 任一场景失败 MUST 使门禁失败

#### Scenario: Structured leak diagnostics
- **WHEN** fault 场景结束
- **THEN** 报告 MUST 包含 activeRuns、activeLaunches、waiters、timers 或等价资源计数
- **AND** 非零泄漏 MUST 导致失败

### Requirement: Cross-backend contract scenarios
Hermetic Agent Service harness MUST 至少覆盖成功、业务失败、需要澄清、取消、恢复、readiness timeout 和连接断开，并输出逐场景结构化状态。

#### Scenario: Clarification is not terminal success
- **WHEN** loopback 后端返回 `need_input` 或等价澄清状态
- **THEN** harness MUST 将场景标记为等待澄清
- **AND** MUST NOT 将其计入完成成功

#### Scenario: Disconnect surfaces stable error
- **WHEN** 后端在请求中断开连接
- **THEN** harness MUST 断言 `remote_disconnected` 或等价稳定错误
- **AND** Run MUST 不得保持无界 running

### Requirement: Live gate status model
Live harness 报告 MUST 区分 `PASS`、`FAIL`、`BLOCKED`、`ADVISORY`，并将环境前置条件与产品行为失败分开记录。

#### Scenario: Environment prerequisite missing
- **WHEN** token、服务 endpoint 或可执行后端不存在
- **THEN** live 报告 MUST 标记 `BLOCKED`
- **AND** hard hermetic 报告 MUST 单独保留真实 PASS/FAIL
