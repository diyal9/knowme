## ADDED Requirements

### Requirement: Orchestration phase in run state machine

AgentRunExecutor MUST 支持阶段 `ORCHESTRATE`（子 Run 创建、等待、汇总）；阶段转换 MUST 写入 trace 与 metrics。

#### Scenario: Delegate enters orchestrate

- **WHEN** 父 Run 调用 delegate_to_expert
- **THEN** runPhases 含 ORCHESTRATE
- **AND** emit 事件含 subRunId

### Requirement: Cancel propagates to child runs

父 Run 取消 MUST 取消所有关联子 Run 与后台进程 registry 条目。

#### Scenario: Cancel parent

- **WHEN** signal.aborted 在父 Run
- **THEN** 活跃子 Run 收到 abort 且 terminal=CANCELLED

## MODIFIED Requirements

### Requirement: Tool loop respects approval gate

当工具 handler 返回 `requiresApproval=true` 时，Executor MUST 将工具步骤标记为 pending_review，MUST NOT 在同一轮将写操作视为已完成证据。

#### Scenario: Draft does not count as done write

- **WHEN** feishu.draft_* 返回 draftId
- **THEN** plan/verify 阶段 MUST NOT 将外部写标记为 done
- **AND** 等待用户 approve 后才可记 applied 证据
