## Why

助理对话已有 A-topic 话题目录，但在对话列右侧且纵向堆叠，与 Codex 式「左侧边距 marker + 与内容对齐 + hover 预览卡片」体验差距大，长对话难以扫读主题分布。

## What Changes

- 左轨为 **固定目录短横线**（自上而下均匀排列，当前主题更深）
- 滚动条回到 **右侧**：3px 极细，仅滚动时出现
- hover 短横线弹出标题 + 助手预览；点击跳到主题起点

## Capabilities

### Modified Capabilities

- `production-ui-surface-parity`: A-topic 对齐 Codex 左轨交互

## Impact

- `agent-topics.ts`、`AssistantTopicNav.tsx`、`AssistantPane.tsx`、`agent-chrome.css`
- 测试：`wave9-parity.spec.ts`、`assistant.spec.tsx`
