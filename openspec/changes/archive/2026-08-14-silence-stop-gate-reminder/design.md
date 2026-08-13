## Context

见 `proposal.md`。项目级 `.cursor/hooks.json` 在 `stop` 事件中同时运行记忆 Hook 与 `stop-gate-reminder.js`。后者只要发现任意活跃 change 就无条件返回 `followup_message`，因此每个正常回答都会触发一次新的可见用户轮次。

该 Hook 属于 Cursor 开发环境，不进入 Electron 主进程、渲染进程或 IPC；修复不得改变 KnowMe 产品运行时。门禁事实来源仍是 harness、OpenSpec 工件和相关命令。

## Goals / Non-Goals

**Goals:**

- 普通 Agent 停止时不产生伪用户消息或续聊循环。
- 保留记忆收尾 Hook 与会话启动上下文。
- 用静态配置测试防止问题回归。
- 不增加启动工作、常驻进程或内存状态。

**Non-Goals:**

- 不修改 Electron 主进程、渲染进程或 IPC。
- 不删除历史 Hook 文件。
- 不改变 Story 门禁脚本及其通过条件。

## Decisions

### 1. 从 `stop` 注册表移除可见提醒 Hook

仅从 `.cursor/hooks.json` 移除 `stop-gate-reminder.js` 注册，保留同组的记忆 Hook。相比让脚本永远返回空对象，取消注册可避免每轮额外启动 Node 进程，行为和性能都更明确。

### 2. 保留脚本文件

项目安全规则要求删除文件需单独确认，且本次无需通过删除实现修复。因此脚本保留但不再被调用，便于审计历史原因，也避免扩大变更范围。

### 3. 门禁提醒留在显式工作流

活跃 change 继续在 `sessionStart` 以 `additional_context` 提供给 Agent；真正的完成检查继续由 `/gate-check`、`/story-done` 和提交前 harness 执行。相比每轮 `stop` 续聊，这些触发点与用户意图一致，不会污染会话。

### 4. 回归测试验证配置而非 Hook 文案

测试读取 `.cursor/hooks.json`，断言 `stop` 中不存在 `stop-gate-reminder.js`，同时确认记忆 Hook 仍注册。这样直接保护造成问题的配置边界。

## Risks / Trade-offs

- [开发者不再每轮看到门禁提醒] → 会话启动上下文和显式门禁命令仍保留完整约束。
- [遗留脚本未来被误重新注册] → 配置契约测试阻止回归。
- [Cursor 尚未热重载配置] → `hooks.json` 通常自动重载；必要时重启 Cursor，不影响仓库代码。

## Migration Plan

1. 更新 `.cursor/hooks.json` 并增加配置契约测试。
2. 直接执行 Hook 配置测试、完整测试和 lint。
3. 下一次 Agent 回复结束时确认不再生成续聊消息。
4. 如需回滚，恢复单条 Hook 注册；无数据迁移。
