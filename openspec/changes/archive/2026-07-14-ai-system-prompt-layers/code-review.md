# Code Review: ai-system-prompt-layers

## 范围

- `src/lib/ai-assistant-context.js`（新）
- `src/lib/settings-secure.js`
- `src/main.js` / `src/note.html` / `src/settings.html`
- 测试

## 结论

- **PASS**：分层拼接清晰；用户无法覆盖底座
- 迁移指纹覆盖旧默认与新底座文本
- 多轮 history 过滤 streaming/loading/error
- 无密钥泄漏路径变更

## 后续建议（非阻塞）

- 可按 token 粗估再截断（当前按字符）
