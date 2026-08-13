## MODIFIED Requirements

### Requirement: Recoverable tool error classification

Agent 工具执行 MUST 将每次失败结果归类（权限 / 单条妙记权限 / 参数 / 未注册工具 /
超时 / 网络 / 缺失资源 / 空结果 / 已取消 / 审批待处理 / 作用域拒绝 / 编排限制 / 未知），并据此决定重试、反思或直接如实反馈。

对网络与超时类错误，系统 MUST 在最终失败前进行有限次**指数退避**重试；退避等待期间 MUST 向执行进度发出可观察的「等待重试」状态。工具执行超时（含外层执行超时）时，系统 MUST 立即将该工具步骤从 pending 收口为超时/失败，并 MUST 终止本 Run 关联的仍在运行的进程类工具子进程，MUST NOT 让已超时调用继续占用进度为「正在调用」。

#### Scenario: Per-minute ACL is not treated as missing app scope

- **WHEN** 工具返回 `No read permission for minute <token>`
- **THEN** 系统将其归类为「单条妙记权限」
- **AND** 反思提示引导改用 `feishu.draft_minute_permission` 或如实说明缺哪个授权，MUST NOT 用相同 `minute_token` 机械重复读取

#### Scenario: Network/timeout are retryable with exponential backoff

- **WHEN** 工具返回网络错误或执行超时
- **THEN** 系统在最终失败前对该调用进行有限次指数退避重试（等待时长随 attempt 指数增长且有上限）
- **AND** 权限/参数/审批待处理/作用域拒绝类错误 MUST NOT 触发自动重试

#### Scenario: Timeout closes pending step and kills process tools

- **WHEN** 外层工具执行超时触发（如 `tool_timeout`）且该调用为进程类工具（如 `run_task`）
- **THEN** 对应执行进度步骤 MUST 立即不再保持 pending「正在调用」态
- **AND** 本 Run 下仍在运行的关联子进程 MUST 被终止

#### Scenario: Backoff wait is visible on the timeline

- **WHEN** 系统决定对某次工具失败进行第 N 次重试且退避等待 > 0
- **THEN** 执行进度 MUST 展示可理解的重试提示（含次数或等待秒数）
- **AND** MUST NOT 在等待期间伪装为仍在成功执行中的无提示 pending

#### Scenario: Approval pending is not retryable

- **WHEN** 工具返回 `approval_required` 或 draft 仍为 pending_review
- **THEN** 系统 MUST NOT 自动重试执行
- **AND** 归类为「审批待处理」
