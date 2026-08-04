# Spec: Agent Tool Execution

## Purpose

为 Agent 工具执行提供失败可恢复能力：对错误分类、有限重试、失败后反思轮，以及受限脚本沙箱，使模型能 Reason → Act → Observe → Reflect，而非一失败即终止。

## Requirements

### Requirement: Recoverable tool error classification

Agent 工具执行 MUST 将每次失败结果归类（权限 / 单条妙记权限 / 参数 / 未注册工具 /
超时 / 网络 / 缺失资源 / 空结果 / 已取消 / 未知），并据此决定重试、反思或直接如实反馈。

#### Scenario: Per-minute ACL is not treated as missing app scope

- **WHEN** 工具返回 `No read permission for minute <token>`
- **THEN** 系统将其归类为「单条妙记权限」
- **AND** 反思提示引导改用 `feishu.draft_minute_permission` 或如实说明缺哪个授权，MUST NOT 用相同 `minute_token` 机械重复读取

#### Scenario: Network/timeout are retryable

- **WHEN** 工具返回网络错误或执行超时
- **THEN** 系统在最终失败前对该调用进行有限次指数退避重试
- **AND** 权限/参数类错误 MUST NOT 触发自动重试

### Requirement: Post-failure reflection round

当某一轮工具调用全部失败且错误可恢复时，Agent MUST 注入反思提示并继续循环，让模型
Reason → Act → Observe → Reflect，而不是一失败即结束。反思 MUST 受最大反思轮数限制，
且当发生重复调用（命中调用缓存）时 MUST 收敛结束，避免无限循环。

#### Scenario: Reflect instead of hard-stopping

- **WHEN** 本轮全部工具失败且存在可恢复类别，且预算未耗尽、未发生重复调用
- **THEN** 系统追加一条按错误类别给出下一步建议的反思提示并继续下一轮
- **AND** 达到最大反思轮数或重复调用时，系统收敛并返回可执行的纠错指引

### Requirement: Sandboxed script tools

Agent MUST 提供受限脚本工具 `run_python` 与 `run_shell`，在每次 Run 独占的临时工作目录内
执行，MUST 强制超时与输出长度上限。破坏性/系统级命令 MUST 被拦截且需用户确认，外联/装包
命令在未开启联网权限时 MUST 被禁止。沙箱 MUST **阻止** Python `urllib`/`requests`/`socket`/`http.client` 与 Node `node -e`/`--eval`/`fetch` 等默认禁网绕过路径。

#### Scenario: Dangerous command is blocked before execution

- **WHEN** 模型请求执行 `rm -rf /`（或同类破坏性/系统命令）
- **THEN** 系统在真正 spawn 之前拦截，返回需用户确认，且 MUST NOT 执行该命令

#### Scenario: Network command is blocked by default

- **WHEN** 模型请求执行 `curl`/`wget`/`pip install` 等外联命令且未开启联网权限
- **THEN** 系统拒绝执行并说明沙箱默认禁止外联

#### Scenario: Benign snippet runs in the scratch workspace

- **WHEN** 模型请求执行一段无害的计算/解析脚本
- **THEN** 系统在临时工作目录内执行，捕获 stdout/stderr，并对超长输出截断

#### Scenario: Python urllib bypass blocked

- **WHEN** 模型通过 run_python 执行 `import urllib.request; urllib.request.urlopen('https://example.com')` 且未授权 network
- **THEN** 执行被拦截或 import 失败，MUST NOT 发起外联

#### Scenario: Node eval fetch bypass blocked

- **WHEN** 模型通过 run_shell 执行 `node -e "fetch('https://example.com')"` 且未授权 network
- **THEN** 命令被拒绝，MUST NOT spawn 可联网的 node -e 进程

### Requirement: run_skill_script permission model

`run_skill_script` MUST 复用沙箱基础设施，且 MUST 要求显式 run 级 permissions：`network`、`write`、`dangerous`（默认均为 false）。未授权时 MUST 返回可理解的拒绝原因。

#### Scenario: Skill script needs network approval

- **WHEN** 模型调用 run_skill_script 且脚本需外联但 run permissions.network=false
- **THEN** 返回需用户授权联网的提示，不执行脚本

#### Scenario: Skill script runs in skill workspace

- **WHEN** run_skill_script 被授权执行
- **THEN** 工作目录限制在该 skill 包内 scripts/ 相对路径，MUST NOT 访问 capabilities 外路径

### Requirement: Sandbox regression tests for network bypass

测试套件 MUST 含针对 Python urllib/requests/socket 与 node -e fetch 绕过场景的回归用例。

#### Scenario: Automated bypass regression

- **WHEN** 运行 `npm test` 沙箱相关用例
- **THEN** 上述绕过场景断言为 blocked
