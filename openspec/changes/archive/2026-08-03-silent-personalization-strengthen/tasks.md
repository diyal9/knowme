# 实施清单

- [x] `product-memory.js`：新增 `buildEffectivePersonalization(memoryDir, userProfile, { limit })`
- [x] `main.js`：ai-generate 使用统一包；返回 `personalization.applied`
- [x] `workspace-agent.js`：快捷入口改用统一摘要，不再拼旧 collaborationPrompt 框架
- [x] `workspace-agent.js`：助手消息渲染「本轮沿用了你的习惯」可展开行
- [x] 测试：包构建、chat 注入、UI 字符串、无条目不展示
- [x] `npm test` + `npm run lint`
