## Purpose

为工作台用户提供可理解的工具发现、权限预检、审批、执行进度、结果与失败恢复体验，降低 Agent 工具链黑盒感。

## ADDED Requirements

### Requirement: Tool discovery and missing capability hints

当模型或用户意图需要未启用工具时，UI MUST 展示「缺失能力」提示，含 Hub 跳转或 Connector 启用指引。

#### Scenario: Feishu write disabled

- **WHEN** 用户要求「发飞书消息」但 IM 写工具未 allowlist
- **THEN** 助手区或时间线展示启用/allowlist 指引
- **AND** MUST NOT 假装已发送

### Requirement: Permission preflight card

对 `requiresApproval=true` 或 `risk=external|destructive` 的工具，执行前 MUST 展示预检卡：工具名、摘要、风险标签、scope、预计副作用。

#### Scenario: File write preflight

- **WHEN** 产生 file write draft
- **THEN** 渲染进程展示 diff 预览与批准/拒绝按钮

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
