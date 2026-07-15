# Tasks: ai-system-prompt-layers

- [x] 1. 新增 `src/lib/ai-assistant-context.js`：固定底座、`buildSystemContent`、`buildChatMessages`、旧默认指纹迁移 helper
- [x] 2. `settings-secure.js`：默认 `userPrompt` 为空；读写迁移 `systemPrompt` → `userPrompt`
- [x] 3. `settings.html`：改标签/说明/占位；读写 `userPrompt`
- [x] 4. `main.js` `ai-generate`：用分层 system + 接收 `history` 拼多轮 messages
- [x] 5. `note.html`：发送时附带近期 user/assistant 历史
- [x] 6. 单测 `tests/ai-assistant-context.test.js` + 更新 settings-secure 测试；`npm test` / `npm run lint`
