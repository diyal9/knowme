## ADDED Requirements

### Requirement: start_process cannot bypass sandbox policy

`start_process` MUST NOT 接受任意 shell 命令字符串绕过 `run_task` 模板与 sandbox。允许的启动方式 MUST 限于：已注册 process template ID、或经 sandbox 同等策略校验的 argv 数组（dangerous/network/allowlist/approval）。

#### Scenario: Arbitrary powershell rejected

- **WHEN** 模型调用 `start_process` 且 command 含 `powershell -Command` 任意 payload
- **THEN** 返回 `scope_denied` 或 `invalid_args`
- **AND** MUST NOT spawn 进程

#### Scenario: Parameter injection blocked

- **WHEN** command 含 `node -e`、`cmd /c` 嵌套引号或环境变量注入模式
- **THEN** MUST 拒绝执行
- **AND** 单测覆盖 ≥3 注入负例

#### Scenario: Windows shell true restricted

- **WHEN** 在 Windows 上 spawn 进程
- **THEN** 默认 MUST NOT 使用 `shell: true` 执行用户可控字符串
- **AND** 若使用 cmd 包装 MUST 使用 argv 数组且无字符串拼接

### Requirement: Process registry eviction

processRegistry MUST 在终态后按 TTL（24h）与 max 500 条 LRU 清理；重启后旧 task id MUST 返回 `expired` 而非 crash。

#### Scenario: Restart old task id

- **WHEN** 应用重启后查询旧 run 的 task id
- **THEN** 返回 expired/not_found 可读文案

## MODIFIED Requirements

### Requirement: Integration with sandbox permissions

任意 shell 命令若未通过 `run_task` 模板，MUST 仍走路由 `run_shell/run_python` 沙箱与 permissions 模型；`run_task` 与 `start_process` MUST NOT 绕过 dangerous/network 拦截。`start_process` MUST 与 sandbox 共用 `screenCommand` / DANGEROUS_PATTERNS / network gate 实现。

#### Scenario: run_task cannot curl

- **WHEN** 模型试图通过篡改 template 参数执行 curl
- **THEN** 系统拒绝或走 sandbox network 拦截

#### Scenario: start_process shares sandbox screen

- **WHEN** `start_process` 收到与 run_shell 相同的危险命令
- **THEN** MUST 被同等规则拦截
