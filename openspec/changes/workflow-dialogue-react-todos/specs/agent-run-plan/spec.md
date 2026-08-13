## ADDED Requirements

### Requirement: Workflow runs require structured plan progression

当 Run 所属 Session 关联非空 `workflowId`，且任务需要多步工具/协作推进时，系统 MUST 在首轮工具循环早期建立非空 `run.plan`（经由 `update_plan` 或受控种子），并在执行中更新条目状态。既有 self-verify 与预算扩展规则 MUST 继续适用于该 plan。

#### Scenario: Workflow run seeds or creates plan early

- **WHEN** 带 workflowId 的 Session 开始多步 Run
- **THEN** 在首轮工具循环内 `run.plan.items` 变为非空（3–7 项为宜）
- **AND** 条目 status 规范化为 pending|doing|done|blocked

#### Scenario: Workflow plan still gates finalize

- **WHEN** 带 workflowId 的 Run 在 plan 仍有 pending/doing 时尝试收敛
- **THEN** 系统按既有 self-verify 规则继续、扩预算或 partial finalize
- **AND** 不静默当作全部完成
