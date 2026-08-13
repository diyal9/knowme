## Why

Agent 对话在 legacy 或兼容流式路径中会把尚未闭合的 Markdown 半行、表格、代码围栏或协议片段先作为纯文本显示，随后再替换为格式化节点，造成明显的“原始内容闪现后刷新”。这会降低回答可信感和阅读稳定性，尤其影响长回答、表格和结构化选择场景。

目标用户是使用 KnowMe 处理长文、表格、代码和工具任务的桌面端用户。稳定、只展示用户可读结果的输出体验有助于提高持续使用意愿，并减少用户误把内部协议或 Markdown 源码当作产品结果的风险。

## What Changes

- 未完成或尚不能稳定格式化的流式尾部只保存在内存，不进入用户可见 DOM。
- 仅将已经闭合、可按最终样式渲染的 Markdown 块追加到回答区。
- 缓冲期间保留低干扰的生成状态，不显示 Markdown 标记、JSON、代码围栏或半截表格。
- 流式完成时一次性格式化剩余合法内容，并在原正文容器中局部收敛。
- 增加回归测试，覆盖标题、列表、表格、代码围栏、链接、suggestion/thinking 与普通文本半行。

### 验收标准

- 用户可见区域中，未完成 Markdown/JSON/协议原文出现时长为 0 ms。
- 同一内容不会先以纯文本出现、随后再替换为格式化节点。
- 已完成的稳定段落可渐进显示，未完成尾部由生成状态承接。
- 完成前后助手气泡和正文容器保持同一 DOM 节点。
- 现有滚动优先级、结构化选择、取消/错误终态和旧会话读取不回归。

### 非目标（Non-goals）

- 不修改模型供应商或要求 provider 输出特定 Markdown。
- 不重新引入工具轮临时正文展示。
- 不替换现有 Markdown parser 或引入前端框架。
- 不展示 chain-of-thought、provider reasoning 或内部协议。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-chat-ux`：流式回答只展示已稳定格式化的内容，未完成尾部必须缓冲且不可先以原始文本显示。

## Impact

- Renderer：`src/workspace-agent.js` 的 streaming Markdown 分块、局部 reconcile 与等待态。
- 测试：`tests/agent-stream-repaint.test.js`、`tests/workspace-agent.test.js` 及新增行为测试。
- 规格：`openspec/specs/agent-chat-ux/spec.md`。
- 不新增依赖，不改变 Electron IPC 或会话存储结构。
