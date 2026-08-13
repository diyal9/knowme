## ADDED Requirements

### Requirement: Tool execution uses contract envelope

Agent 工具执行 MUST 经 Tool Registry 校验并返回统一 envelope（见 tool-contract-registry）；`agent-tool-failure-hint` MUST 识别新 code：`approval_required`、`scope_denied`、`patch_conflict`、`orchestration_depth_exceeded`、`pdf_too_large`。

#### Scenario: Approval required hint

- **WHEN** 工具返回 `approval_required`
- **THEN** 反思提示引导用户打开审批卡
- **AND** MUST NOT 自动重试同一写操作

## MODIFIED Requirements

### Requirement: Recoverable tool error classification

Agent 工具执行 MUST 将每次失败结果归类（权限 / 单条妙记权限 / 参数 / 未注册工具 /
超时 / 网络 / 缺失资源 / 空结果 / 已取消 / 审批待处理 / 作用域拒绝 / 编排限制 / 未知），并据此决定重试、反思或直接如实反馈。

#### Scenario: Per-minute ACL is not treated as missing app scope

- **WHEN** 工具返回 `No read permission for minute <token>`
- **THEN** 系统将其归类为「单条妙记权限」
- **AND** 反思提示引导改用 `feishu.draft_minute_permission` 或如实说明缺哪个授权，MUST NOT 用相同 `minute_token` 机械重复读取

#### Scenario: Network/timeout are retryable

- **WHEN** 工具返回网络错误或执行超时
- **THEN** 系统在最终失败前对该调用进行有限次指数退避重试
- **AND** 权限/参数/审批待处理/作用域拒绝类错误 MUST NOT 触发自动重试

#### Scenario: Approval pending is not retryable

- **WHEN** 工具返回 `approval_required` 或 draft 仍为 pending_review
- **THEN** 系统 MUST NOT 自动重试执行
- **AND** 归类为「审批待处理」
