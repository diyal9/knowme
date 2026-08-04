# Retro: silent-personalization-strengthen

## 结论

KnowMe 个性化走「静默生效 + 事后可解释」，不恢复输入框勾选条。

## 做对了什么

- 统一 `buildEffectivePersonalization`，普通对话与快捷入口同源
- chat tier 保留 light personalization，不灌 work memory
- 回复旁默认收起的「本轮沿用了 N 条习惯」

## 注意

- 关于我/行业仍在 system `buildUserPrompt`，未进 Packet 展开列表（ADVISORY）
- qa-plan 的 Smoke Scope 须带 `- [ ]`/`- [x]`，否则 harness 报 SMOKE-SCOPE-EMPTY

## 升格建议

暂不升 Skill；产品约定可写入 OKF concept「静默个性化」若后续复用。
