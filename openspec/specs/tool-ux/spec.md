# tool-ux Specification

## Purpose

为工作台用户提供可理解的工具发现、权限预检、审批、执行进度、结果与失败恢复体验，降低 Agent 工具链黑盒感。

## Requirements

### Requirement: Tool discovery and missing capability hints

当模型或用户意图需要未启用工具时，UI MUST 展示「缺失能力」提示，含 Hub 跳转或 Connector 启用指引。

#### Scenario: Feishu write disabled

- **WHEN** 用户要求「发飞书消息」但 IM 写工具未 allowlist
- **THEN** 助手区或时间线展示启用/allowlist 指引
- **AND** MUST NOT 假装已发送

### Requirement: Permission preflight card

对 `requiresApproval=true` 或 `risk=external|destructive` 的工具，执行前 MUST 展示预检卡：工具名、**可读对象摘要**、风险标签、scope、预计副作用。

#### Scenario: File write preflight

- **WHEN** 产生 file write draft
- **THEN** 渲染进程展示 diff 预览、对象摘要与批准/拒绝按钮

### Requirement: Execution progress and cancel

长时间工具 MUST 在时间线显示 running 状态、耗时与「取消」入口；取消 MUST 调用主进程 abort。

#### Scenario: Cancel running task

- **WHEN** 用户点击取消 run_task
- **THEN** 时间线步骤变为 cancelled
- **AND** 后续不再追加该任务输出

### Requirement: Result artifact and failure recovery

工具完成后 MUST 提供「查看结果」「复制」「打开 artifact」入口；失败 MUST 提供恢复建议（重试、改参数、启用 Connector、查看 audit）。

#### Scenario: Failed tool shows recovery

- **WHEN** 工具返回 `scope_denied`
- **THEN** UI 展示原因与「检查内容源绑定」建议

### Requirement: Draft inbox

用户 MUST 可从工作台访问 pending drafts 列表（file + feishu + 高风险 mcp），批量批准/拒绝。

#### Scenario: Pending draft badge

- **WHEN** 存在未处理 draft
- **THEN** 工作台显示待审批计数

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
