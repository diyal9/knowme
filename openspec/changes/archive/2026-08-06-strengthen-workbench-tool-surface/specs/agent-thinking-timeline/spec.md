## ADDED Requirements

### Requirement: Approval and draft steps in timeline

时间线 MUST 展示审批类工具步骤：状态 pending_review/approved/rejected/applied；展开详情 MUST 含 preview 摘要与审批入口（若仍 pending）。

#### Scenario: Pending approval visible

- **WHEN** 工具返回 requiresApproval 与 draftId
- **THEN** 时间线该步骤标记为「待确认」且可跳转审批卡

### Requirement: Orchestration and sub-run summary

当 Run 含子 Agent 委派时，时间线 MUST 展示 delegation 行，含 expert 名、子 Run 状态与结果摘要链接。

#### Scenario: Sub-run completed

- **WHEN** 子 Run 成功完成
- **THEN** 父时间线 delegation 步骤显示 done 与 summary 首行

## MODIFIED Requirements

### Requirement: Timeline shows evidence and verification status

执行过程时间线 MUST 展示工具/evidence 状态：ok、fail、empty、truncated、blocked、pending_review、cancelled，并提供来源 provenance 入口（工具名、refId、evidenceId、auditId）。MUST NOT 在 ledger 无 ok 证据时将工具步骤显示为已成功读取。

#### Scenario: Truncated tool shows badge

- **WHEN** 工具结果 truncated=true
- **THEN** 步骤展示 truncated 状态而非 ok

#### Scenario: Pending review not shown as success

- **WHEN** 写工具 draft 仍 pending_review
- **THEN** 步骤 MUST NOT 显示为已成功写入外部系统
