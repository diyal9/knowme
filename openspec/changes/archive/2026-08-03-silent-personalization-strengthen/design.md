# 设计：静默个性化加强

## 决策

1. **Effective Personalization Packet** 落在 `product-memory.buildEffectivePersonalization()`，输出：
   - `items[]`：`{ id, kind, text, source }`（user_prompt / confirmed_habit）
   - `promptBlock`：给模型的短摘要文本
   - `applied[]`：实际拟注入条目（限长后）
   - `omitted[]`：因条数上限裁掉的条目

2. **注入位置**：`promptBlock` 并入 dynamic personalization（或 chat 时并入 system 旁的稳定短段），不再让快捷入口单独拼 `collaborationPrompt` 长框架。

3. **可解释 UI**：`ai-generate` 返回 `personalization: { applied }`；渲染进程在助手气泡底部放一行可展开的「本轮沿用了 N 条习惯」。

4. **非目标**：不改设置页大改版；不增强 telemetry 捕获（可后续）；不恢复勾选条。

## 风险

- 提示过多会打扰 → 默认收起，仅一行 meta
- 与 budget 冲突 → 包内先硬限 4 条，再交给 orchestrator
