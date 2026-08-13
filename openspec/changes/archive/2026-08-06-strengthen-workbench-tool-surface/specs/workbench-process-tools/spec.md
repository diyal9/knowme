## Purpose

为 Agent 提供可观测、可取消、有超时的进程与结构化任务执行能力，支撑「修改→跑 test/lint/build→读日志→验证」闭环。

## ADDED Requirements

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

任意 shell 命令若未通过 `run_task` 模板，MUST 仍走路由 `run_shell/run_python` 沙箱与 permissions 模型；`run_task` MUST NOT 绕过 dangerous/network 拦截。

#### Scenario: run_task cannot curl

- **WHEN** 模型试图通过篡改 template 参数执行 curl
- **THEN** 系统拒绝或走 sandbox network 拦截
