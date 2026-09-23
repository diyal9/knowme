# Delta Spec: agent-run-executor

## ADDED Requirements

### Requirement: Run identity preserves lane and retry lineage

每个 Agent Run MUST 保存 lane 与稳定 `runId`，并按场景关联可选的 task、turn、root/parent Run、workflow node attempt 和消息 ID。重试 MUST 使用新 `runId` 并记录 lineage，MUST NOT 复用旧 Run 的事件序号或 terminal 状态。

#### Scenario: Expert execution is retried

- **GIVEN** 专家 Run R1 失败且用户触发重试
- **WHEN** 系统创建 R2
- **THEN** R2 具有新的 `runId` 并记录 `retryOfRunId=R1`
- **AND** R1 的迟到事件不能更新 R2 的消息或任务状态

#### Scenario: Workflow agent node runs a second attempt

- **WHEN** 同一 workflow node 启动第二次 attempt
- **THEN** identity 保留相同 rootRunId 和 workflowNodeId
- **AND** nodeAttempt 与 child runId 均不同于第一次

#### Scenario: Partner turn has no formal task

- **WHEN** 伙伴执行一次普通对话
- **THEN** Run 可只关联 turn、session 和 message identity
- **AND** MUST NOT 为满足公共类型而伪造 expert taskId

### Requirement: Checkpoint recovery validates identity decisions and receipts

Run checkpoint MUST 继续受事件日志 `lastSeq` 约束，并保存恢复所需的 execution identity、任务合同版本、内部计划版本、pending decision/draft 引用和 receipt 引用。恢复时任何 lineage、序号或权威记录不一致 MUST fail closed 为 `resume_unsafe` 或等价等待状态。

#### Scenario: Checkpoint is ahead of the event log

- **WHEN** checkpoint.lastSeq 大于事件日志最大序号
- **THEN** 系统拒绝自动恢复
- **AND** MUST NOT 重放工具或制造缺失事件

#### Scenario: Confirmed contract changed after checkpoint

- **GIVEN** checkpoint 绑定合同 fingerprint C1
- **WHEN** 当前专家任务有效合同为 C2
- **THEN** 旧 checkpoint 不能继续正式执行
- **AND** 系统要求重新确认或进入可解释恢复状态

#### Scenario: Pending operation has an uncertain receipt

- **WHEN** 恢复发现非幂等操作 outcome 为 `uncertain`
- **THEN** 系统进入待核实状态
- **AND** MUST NOT 自动再次 dispatch 相同操作

### Requirement: Cancellation freezes projection while preserving late execution evidence

Run 取消后 MUST 停止派发新的模型、工具和子 Run，并冻结用户可见 Run 终态。取消前已经派发的操作 MAY 返回迟到回执；host MUST 保存真实回执，但 MUST NOT 用其把 cancelled Run 改为 completed 或再次提交回答。

#### Scenario: External write succeeds after cancel

- **GIVEN** 写操作已发往 Provider 后用户取消 Run
- **WHEN** Provider 随后返回成功回执
- **THEN** host 保存 `executed` receipt 和审计引用
- **AND** Run 仍为 cancelled，Renderer 不提交新回答

#### Scenario: No work starts after cancel

- **WHEN** Run 已进入 cancelled
- **THEN** 不再发起新的 LLM、tool 或 child Run
- **AND** 迟到的普通 progress/answer 事件被判为 frozen
