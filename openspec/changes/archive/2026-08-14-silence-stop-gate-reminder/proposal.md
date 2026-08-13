## Why

项目级 `stop` Hook 在每次 Agent 回复结束时都输出 `followup_message`，Cursor 会将其渲染成新的用户轮次，导致开发者反复看到并未发送的“活跃 change”消息，干扰正常对话并混淆消息归属。

目标用户是使用本仓库 Cursor Agent 工作流的开发、制作人与测试成员。消除伪用户消息可以降低协作噪声和误判成本，让门禁提醒只在真正需要执行门禁时出现。

## What Changes

- 停止在通用 `stop` 事件中注入可见的门禁续聊消息。
- 保留 `sessionStart` 的只读团队上下文，以及 `/gate-check`、`/story-done` 和提交前的既有硬门禁。
- 保留原 Hook 脚本文件作为历史兼容，不执行删除等破坏性清理。
- 增加配置契约测试，防止 `stop` Hook 再次注册可见续聊提醒。

验收标准：
- 普通 Agent 回复结束后不会自动生成“活跃 change”用户轮次。
- 会话启动时仍能获得活跃 change 上下文。
- `/gate-check`、`/story-done` 与提交前门禁约束保持不变。
- 相关测试与 lint 通过。

非目标（Non-goals）：
- 不改变 OpenSpec 门禁顺序或降低 Story 完成要求。
- 不修改 Cursor 用户级 Hook。
- 不清理其他记忆、危险命令防护或文件编辑提醒 Hook。

## Capabilities

### New Capabilities

无。本变更仅修复仓库开发工具配置，不改变 KnowMe 产品运行时能力。

### Modified Capabilities

无。已在 `.openspec.yaml` 中声明 `skip_specs: true`。

## Impact

- `.cursor/hooks.json`：取消注册会制造可见续聊轮次的 `stop-gate-reminder.js`。
- `tests/`：增加 Hook 配置回归契约。
- 不新增依赖，不影响 Electron 产品运行时、IPC 或用户数据。
