# QA Plan：Agent 多阶段输出管线

## Smoke Scope

- [x] 工具轮临时 prose 不进入最终回答区；执行过程持续可见。
- [x] canonical answer 提交后不清空、不缩短、不静默覆盖。
- [x] suggestion 围栏、bare JSON、半截 JSON 与非法 JSON 在用户界面均零泄漏。
- [x] 合法结构化选择直接进入独立按钮区，点击与锁定行为正常。
- [x] progress/tool/answer/ui/terminal 重复或乱序时 UI 幂等，terminal 后冻结。
- [x] Run 完成前后历史消息、当前气泡与正文容器保持同一节点身份。
- [x] 用户发送后滚到底部；生成中主动上滑后所有 lane 不抢回视口。
- [x] pending review 在回答/terminal 后保持展开，批准/拒绝入口可用。
- [x] cancelled/error/completed 三种终态可区分且无 IPC 克隆错误。
- [x] 旧会话正文、trace、suggestion 恢复正常；新会话持久化 hash/ui/version 一致。
- [x] 长 Markdown、表格、代码块和结构化选择组合时布局稳定。
- [x] UI 不展示 provider reasoning、内部协议字段或敏感工具原文。

## 自动化

- `node --test tests/agent-output-protocol.test.js tests/agent-output-assembler.test.js tests/agent-message-state.test.js`
- `node --test tests/agent-run-executor.test.js tests/agent-streaming-integration.test.js tests/agent-suggestion.test.js`
- `node openspec/changes/refactor-agent-multistage-output-pipeline/evidence/agent-output-electron-smoke.js`
- `npm test`
- `npm run lint`
- `openspec validate refactor-agent-multistage-output-pipeline --strict`
- `node .cursor/scripts/harness.js gate --json`

## 定量门槛

- raw JSON 用户可见时长：0 ms。
- canonical 正文清空/缩短/覆盖：0 次。
- 完成前后历史消息、气泡与正文容器 `isSameNode`：100%。
- 非 stick 状态 10 次事件后的 `scrollTop` 漂移：小于 8 px。
- 重复/迟到事件导致的 DOM 更新：0 次。
- 每个 Run terminal 事件：恰好 1 个。

## 反模式检查

- 把工具前导语或模型草稿当最终回答展示。
- 完成后用 invoke 返回值再次覆盖正文。
- 同时消费 `ai-stream-event` 与 `ai-stream-chunk`。
- 结构化 JSON 先以代码块/纯文本出现再变按钮。
- 每个阶段或 terminal 都调用 `renderChat()` 重建会话。
- 为弥补缓冲延迟伪造 provider 打字速度。
- terminal 后接受迟到事件或把 pending review 标为普通 done。
- 日志记录 chain-of-thought、API Key 或完整敏感工具结果。
