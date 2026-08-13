## Why

通用助手生成中切换到工作台等其它页面再回来时，对话区被清空、停止按钮残留、回复丢失。根因是切面 `activateSession` 用磁盘快照覆盖内存流式气泡，流事件找不到 `runId` 对应消息。高频入口的信任被直接打断，必须立刻修。

### 目标用户

- 边聊边切工作台 / 自动化 / 其它栏位的日常助理用户。

### 商业化与体验价值

生成中切页仍能回来看到同一条对话与完整回复，降低「产品丢消息」感知，保住助理作为高频入口的可信度。

## What Changes

- 生成中切面时 MUST 保活该 Session 的内存 `chatHistory`（含 streaming 气泡），不得用空/半持久化磁盘态覆盖。
- 流事件 MUST 能更新保活中的消息，即使当前 UI 在另一 surface。
- 切回原 Session 时 MUST 恢复保活对话；生成结束后再与持久化对齐并释放保活。
- 完成写入 Session 元数据时 MUST 绑定发起 run 的 sessionId，不得误写到切面后的 `activeSession`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-chat-ux`: 生成中跨 surface 切换时对话与停止态不得被清空或卡死。
- `agent-session-tabs`: 切面激活 Session 时，若该 Session 有进行中的 run，优先恢复内存保活历史。

## Impact

- `src/workspace-agent.js`：`activateSession`、`runAI` / `resolveAssistantRef`、完成态落盘。
- 测试：`tests/workspace-agent.test.js` 静态契约。
- 不改主进程 Session schema；不改 IPC。

### 验收标准

- 助理发送后立刻切工作台再切回：用户消息与生成中/完成后的助手气泡仍在；无空白空态叠停止按钮。
- 生成完成后停止按钮恢复为发送；回复完整可见。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不做多 Session 并行生成。
- 不拆独立 DOM 对话列。
- 不改主进程 `ai-generate` 持久化时序（用户消息仍由主进程早落盘）。
