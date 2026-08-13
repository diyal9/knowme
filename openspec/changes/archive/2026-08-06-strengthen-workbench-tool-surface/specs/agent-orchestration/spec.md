## Purpose

让 Agent Run 可委派专家/子 Agent、有限并行执行、handoff 上下文并汇总结果，且全程可取消、可追踪，与 Expert runtime 及 Workbench Daemon 对齐。

## ADDED Requirements

### Requirement: Delegate to expert sub-run

系统 MUST 提供 `delegate_to_expert` 工具，参数含 `expertId`、`prompt`、`handoffContext`（optional）；子 Run MUST 使用 Expert 快照绑定的工具子集。

#### Scenario: Sub-run inherits expert tools

- **WHEN** 父 Run 委派至专家「写作教练」
- **THEN** 子 Run 仅暴露该专家绑定且 enabled 的工具
- **AND** 父 Run trace 显示 delegation 步骤

#### Scenario: Depth limit

- **WHEN** 子 Run 试图再次 delegate
- **THEN** 返回 `orchestration_depth_exceeded`
- **AND** MUST NOT 创建孙 Run

### Requirement: Parallel sub-runs with budget

系统 MUST 支持有限并行（默认每 Run ≤1 并行子 Run）；并行 MUST 共享父 Run 取消信号。

#### Scenario: Parallel cap

- **WHEN** 已有 1 个 running 子 Run 再请求并行
- **THEN** 第二个请求排队或返回 `parallel_cap`

#### Scenario: Parent cancel stops children

- **WHEN** 用户取消父 Run
- **THEN** 所有 active 子 Run MUST 在 3s 内取消

### Requirement: Handoff and result aggregation

`handoffContext` MUST 序列化为 JSON（≤32KB）；子 Run 完成后 MUST 将 summary 合并回父 Run 消息上下文；可选通过 Workbench Daemon API 同步 slug artifact。

#### Scenario: Handoff visible in trace

- **WHEN** handoff 含 requirementId
- **THEN** 时间线展示 handoff 来源与目标 expert

#### Scenario: Failed sub-run surfaces error

- **WHEN** 子 Run 以 ERROR 终止
- **THEN** 父 Run 收到结构化 error summary
- **AND** MUST NOT 静默吞掉

### Requirement: Observability

Orchestration 事件 MUST emit `runPhase=ORCHESTRATE`（或等价）且含 subRunId、expertId、status。

#### Scenario: Timeline shows sub-run

- **WHEN** 子 Run 执行工具
- **THEN** 父时间线可展开查看子 Run 摘要（不必嵌套全部工具细节）
