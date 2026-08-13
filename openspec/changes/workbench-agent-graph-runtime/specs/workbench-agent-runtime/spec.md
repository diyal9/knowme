## Purpose

让已确认的本地 Agent Graph 通过 KnowMe 现有的 Team Runtime 执行，形成可持久化、可观测、可审批、可重试的真实父子 Run，而不是由 Renderer 维护一个无法恢复的临时状态机。

## ADDED Requirements

### Requirement: Local graph execution

工作台 MUST 将确认后的本地 Graph 编译为受校验的 Team Package，并通过本地 Agent Team Runtime 创建 Root Run 和对应的 child Run；Renderer MUST NOT 直接实现 Agent loop。

#### Scenario: Start a confirmed graph

- **WHEN** 用户确认一个通过校验的本地 Agent Graph
- **THEN** 系统创建可追踪的 Root Run，并按 Graph 依赖启动对应 Agent child Run

#### Scenario: Preserve handoff context

- **WHEN** 一个 Agent 节点完成并向后继节点交付结果
- **THEN** 后继节点收到经过校验的 handoff、artifact 引用和 evidence 引用

### Requirement: Runtime state projection

工作台 MUST 将 Root Run 和 child Run 的状态投影到 Graph 节点、当前负责人、进度、日志、产物和下一步操作；状态 MUST 区分运行中、等待、阻塞、成功、失败、取消和恢复中。

#### Scenario: Show child run progress

- **WHEN** 本地 Agent child Run 状态或阶段发生变化
- **THEN** 工作台更新对应 Graph 节点和 Run Tree，而不把整个任务错误显示为单一“正在执行”

#### Scenario: Show terminal result

- **WHEN** Root Run 进入成功、失败或取消终态
- **THEN** 工作台显示真实终态、摘要、artifact/evidence 和相应的查看、重试或返回操作

### Requirement: Human gate handling

工作台 MUST 将 Graph 中的 gate 映射为本机用户审批；等待审批时 MUST 停止依赖该 gate 的后继节点，且不得自动批准或绕过。

#### Scenario: Approve a gate

- **WHEN** 用户在工作台批准等待中的 gate
- **THEN** Runtime 只推进该 gate 的合法后继节点，并在 Run Tree 中记录审批结果

#### Scenario: Reject a gate

- **WHEN** 用户拒绝或要求修订 gate
- **THEN** Runtime 按 Graph 定义停止或回滚，不得伪造后继节点已完成

### Requirement: Recovery actions

工作台 MUST 为失败、取消和可恢复的 Run 提供与 Runtime 能力一致的操作；若应用重启后缺少安全恢复上下文，MUST 显示重新确认，而不是声称已恢复执行。

#### Scenario: Retry failed child

- **WHEN** 用户对失败节点选择重试
- **THEN** 系统创建符合幂等约束的新尝试，并保留原失败记录

#### Scenario: Resume unavailable

- **WHEN** 已持久化 Run 没有可用的原会话执行上下文
- **THEN** 工作台显示需要重新确认或重新发起，并不调用不存在的恢复能力

### Requirement: Daemon execution remains distinct

Daemon workflow MUST 继续作为独立执行来源；工作台 MUST 清楚区分本地 Team Run 和 Daemon Task 的状态、标识和恢复语义。

#### Scenario: Launch a Daemon workflow

- **WHEN** 用户选择 Daemon workflow
- **THEN** 工作台继续通过 Daemon Client 创建和轮询远程 Task，并不得将其伪装成本地 child Run
