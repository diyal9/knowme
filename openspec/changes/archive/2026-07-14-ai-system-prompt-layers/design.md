# Design: ai-system-prompt-layers

## 架构

```
┌─────────────────────────────────────────┐
│ system role                             │
│  1. ASSISTANT_BASE_PROMPT (固定)         │
│  2. ## 用户偏好  ← settings.userPrompt  │
│  3. 知识库摘要 / 近期记忆（动态）          │
├─────────────────────────────────────────┤
│ messages[]                              │
│  …近 N 轮 history (user/assistant)       │
│  本轮 user = 便签正文(可选) + 用户需求     │
└─────────────────────────────────────────┘
```

## 进程边界

| 层 | 位置 |
|----|------|
| `ASSISTANT_BASE_PROMPT` + `buildAssistantMessages` | `src/lib/ai-assistant-context.js`（纯 Node，可单测） |
| 组装并调 API | `main.js` `ai-generate` |
| 设置 UI | `settings.html` |
| 传 history | `note.html` → preload → IPC |

## 设置字段

- 持久化键：`userPrompt`（新语义）
- 兼容：读到仅有 `systemPrompt` 时迁移；命中旧默认指纹则置空并落盘 `userPrompt`
- `settings-secure` 不再把整段旧 DEFAULT 当默认助手人格写进用户设置

## 截断策略

- 历史最多 **6 轮**（12 条 message），超出丢弃最旧
- 单条内容截断至约 4k 字符；便签上下文约 6k
- 知识/记忆仍由 `getContextForAI` 限长

## 风险

- 自定义过旧「整段 system」的用户：迁移后其文案变为「偏好」追加在底座后，行为略变（底座规则优先）——符合产品意图
