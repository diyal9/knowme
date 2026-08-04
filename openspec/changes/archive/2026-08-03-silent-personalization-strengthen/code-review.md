# Code Review：silent-personalization-strengthen

## 范围

- `src/lib/product-memory.js`：`buildEffectivePersonalization`
- `src/main.js`：ai-generate / memory-insights 统一包
- `src/workspace-agent.js`：快捷入口同源摘要 + 回复旁可解释行
- `src/workspace.html`：低干扰样式

## 结论

PASS（开发自检）

## 备注

- 不恢复勾选条；personalized meta 默认收起。
- chat tier 仍关 work memory，仅保留 light personalization。
