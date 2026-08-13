# workbench-process-tools Specification

## Purpose

为 Agent 提供可观测、可取消、有超时的进程与结构化任务执行能力，支撑「修改→跑 test/lint/build→读日志→验证」闭环。

## Requirements

### Requirement: Structured run_task templates

系统 MUST 提供 `run_task`，内置模板至少含：`npm test`、`npm run lint`、`npm run build`；任务 MUST 限制 cwd 为活跃内容源根或 Run 沙箱目录。

#### Scenario: npm test in content source

- **WHEN** 模型调用 `run_task` 且 template=`npm test`
- **THEN** 系统在内容源根执行对应 npm script
- **AND** 返回 exitCode、stdout/stderr 摘要（受输出上限约束）

#### Scenario: Unknown template rejected

- **WHEN** template 不在允许列表
- **THEN** 返回 `invalid_args`

### Requirement: Process lifecycle tools

系统 MUST 提供 `start_process`、`task_status`、`task_logs`、`cancel_task` 管理后台进程；每个进程 MUST 绑定 runId 与 auditId。

#### Scenario: Long process status

- **WHEN** 后台进程仍在运行
- **THEN** `task_status` 返回 running 与已运行时长

#### Scenario: Cancel propagates

- **WHEN** 用户取消 Agent Run 或调用 `cancel_task`
- **THEN** 关联子进程 MUST 在 3s 内收到终止信号并标记 cancelled

### Requirement: Timeout and output caps

进程工具 MUST 强制 `timeoutMs`（默认与 Registry 一致，可 per-tool 覆盖）与 stdout/stderr 字符上限；超时 MUST 返回 `timeout` 且 kill 进程树。

#### Scenario: Hung process timeout

- **WHEN** 进程超过 timeout
- **THEN** 返回 `timeout`
- **AND** 进程 MUST NOT 继续占用端口/文件锁（best-effort kill）

### Requirement: Integration with sandbox permissions

任意 shell 命令若未通过 `run_task` 模板，MUST 仍走路由 `run_shell/run_python` 沙箱与 permissions 模型；`run_task` 与 `start_process` MUST NOT 绕过 dangerous/network 拦截。`start_process` MUST 与 sandbox 共用 `screenCommand` / DANGEROUS_PATTERNS / network gate 实现。

#### Scenario: run_task cannot curl

- **WHEN** 模型试图通过篡改 template 参数执行 curl
- **THEN** 系统拒绝或走 sandbox network 拦截

#### Scenario: start_process shares sandbox screen

- **WHEN** `start_process` 收到与 run_shell 相同的危险命令
- **THEN** MUST 被同等规则拦截

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
