## Why

Agent 的多轮模型与工具执行目前把轮内临时正文、最终答复和结构化选择复用为同一文本通道，导致正文先出现后被覆盖、完成态刷新，以及 JSON 先暴露再变成按钮。随着飞书、知识库和写入审批等长链路增多，这种不稳定反馈会直接削弱用户对结果可信度与产品可持续使用价值的判断。

## What Changes

- 引入版本化多 lane 输出协议，将 progress、tool、answer、ui 与 terminal 事件分离，并为每个 Run 提供单调序号。
- 工具可用、grounding 或 post-process 可能改写正文时，模型轮内正文先在主进程缓冲；只有经过工具判定、后处理和输出门禁的 canonical answer 才提交到 Renderer。
- 将结构化选择从 Markdown 正文拆成独立 `choice.ready` UI 事件，未完成或非法 JSON 永不进入用户可见正文。
- Renderer 使用固定助手消息骨架和显式状态机，执行过程、最终回答、结构化 UI 与动作区分别增量更新。
- 统一 Electron 正文事件路径，停止 `ai-stream-event` 与 `ai-stream-chunk` 双发/双消费；invoke 返回值只确认终态，不静默覆盖正文。
- 新会话消息可持久化 `protocolVersion` 与结构化 `ui`；旧 `{ role, text, trace }` 会话继续可读，并在加载时兼容提取 suggestion。
- 增加协议、缓冲、Reducer、DOM 身份、滚动与 Electron fixture 门禁。
- **BREAKING（内部协议）**：Renderer 实时输出改为 v2 envelope，旧 chunk 通道仅在迁移窗口保留兼容入口，验收完成后移除正常消费。

## Capabilities

### New Capabilities

- `agent-output-protocol`: 定义 Run 级版本化事件 envelope、多 lane 语义、canonical answer 提交、结构化 UI 与终态约束。

### Modified Capabilities

- `agent-chat-ux`: 助手消息改为固定骨架；最终正文不回滚；结构化选择零 JSON 泄漏；完成态与滚动保持稳定。
- `agent-thinking-timeline`: progress/tool lane 驱动执行过程，运行中可追踪、完成后降噪且待确认步骤保持可见。
- `agent-run-executor`: 工具轮正文缓冲，后处理、grounding、验证与再生成全部发生在 canonical answer commit 之前。

## Impact

- 目标用户：在 KnowMe 中执行知识库检索、飞书读取、文档生成和待确认写入等多步骤任务的知识工作者。
- 体验与商业价值：用稳定、可解释且无协议泄漏的多阶段反馈降低“答案被覆盖/系统失控”的不确定感，提升复杂工作流完成率、信任与持续使用意愿。
- 受影响代码：`src/lib/agent-run-executor.js`、`src/lib/agent-run-kernel-adapter.js`、`src/main.js`、`src/preload.js`、`src/workspace-agent.js`、会话持久化与 suggestion 解析模块。
- 新模块：输出协议、输出 assembler、Renderer 消息 reducer。
- 数据兼容：不批量改写用户历史数据；加载旧消息时惰性兼容，新消息增加可选字段。
- 验收标准：
  - 工具轮临时正文不进入最终回答区，canonical answer 提交后不清空、不缩短、不静默覆盖。
  - raw suggestion/thinking JSON 在所有流式与完成路径中的用户可见时长为 0。
  - 正常 Run 完成前后历史消息、助手气泡和正文容器节点身份保持不变。
  - progress/tool/answer/ui/terminal 事件按单调序号消费，重复或乱序事件不破坏 UI。
  - 用户主动上滑后，后续事件不抢回滚动位置；pending review 始终可发现。
  - 旧会话仍可显示正文、时间线和结构化选择；取消与错误终态无 IPC 克隆或内部对象泄漏。
  - 单元/集成/Electron fixture、`npm test`、`npm run lint`、OpenSpec strict validate 与 harness gate 通过。
- 非目标（Non-goals）：
  - 不展示模型原始 chain-of-thought 或 provider reasoning。
  - 不更换模型供应商、工具定义、外部连接器 API 或 Electron 框架。
  - 不在本 change 中引入虚拟列表、第三方前端框架或全量重写 Markdown parser。
  - 不伪造 provider 流式速度；稳定优先的缓冲路径允许最终正文稍晚一次性提交。
