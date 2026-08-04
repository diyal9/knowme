# 静默个性化加强

## 动机

KnowMe 的定位是「越用越懂你」，而不是让用户在输入框旁勾选记忆芯片。上一轮已下线 composer 勾选条；下一步应加强**静默个性化**：习惯与协作偏好自动生效，用户能在需要时看清「本轮用了什么」，而不是被迫做开关操作。

现状缺口：

1. **注入链路分散**：普通对话走 `userPrompt + personalizationContext`，快捷入口另拼 `collaborationPrompt`。
2. **轻聊天偏弱**：`chat` tier 不走完整记忆上下文，已确认习惯主要靠 dynamic section，易被预算裁掉。
3. **无感知**：设置页能看「已应用习惯」，工作台却看不到「本轮实际沿用了哪些」。

## 变更

- 统一产出「本轮生效个性化包」（资料 / 手填偏好 / 已确认习惯 / 裁剪说明）
- 普通对话与快捷入口共用同一包，去掉分叉
- `chat` 轻对话也注入严格限长的偏好摘要（仅已确认 + 手填，不含 telemetry）
- 助手回复旁提供低干扰的「本轮沿用了你的习惯」入口（可展开看条目），**不恢复输入框勾选条**

## 影响

- 能力：`agent-context-assembly`、`agent-chat-ux`（可解释，非勾选）
- 代码：`product-memory.js`、`main.js`（ai-generate）、`workspace-agent.js`、可选 `context-packet.js`
- 非目标：意图推荐芯片（去 AI 味 / 格式化等）另立项；不恢复 composer 「本轮带上」
