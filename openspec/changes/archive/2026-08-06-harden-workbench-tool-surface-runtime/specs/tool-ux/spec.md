## ADDED Requirements

### Requirement: Approval card readable object summary

审批卡与时间线 MUST 为 write/patch/move/飞书 draft 展示可读对象摘要（如文件名、move 源→目标、飞书文档标题/connector），不得仅显示通用「待确认」。

#### Scenario: File write shows path in summary

- **WHEN** file write draft 待审批
- **THEN** 审批卡 summary 含 target 文件名或相对路径
- **AND** 不展开 diff 也能识别目标

#### Scenario: Feishu draft shows connector and title

- **WHEN** 飞书 doc draft 待审批
- **THEN** summary 含 connector 类型与文档标题摘要

### Requirement: Pending approval buttons disabled with loading

批准/拒绝按钮在 pending→applying 期间 MUST disabled 且显示 loading，防止快速连点。

#### Scenario: Double click prevented

- **WHEN** 用户快速连点批准
- **THEN** 仅触发一次 IPC
- **AND** 按钮在 applying 时 disabled

### Requirement: Rollback UI entry for applied file drafts

对已应用且支持 rollback 的 file draft，UI MUST 提供「回滚到备份」入口，调用现有 rollback IPC。

#### Scenario: Rollback button visible after apply

- **WHEN** file write 已 applied 且 backup 存在
- **THEN** 时间线或 draft 详情显示回滚按钮
- **AND** 点击后文件恢复且 UI 反馈成功/失败

## MODIFIED Requirements

### Requirement: Permission preflight card

对 `requiresApproval=true` 或 `risk=external|destructive` 的工具，执行前 MUST 展示预检卡：工具名、**可读对象摘要**、风险标签、scope、预计副作用。

#### Scenario: File write preflight

- **WHEN** 产生 file write draft
- **THEN** 渲染进程展示 diff 预览、对象摘要与批准/拒绝按钮
