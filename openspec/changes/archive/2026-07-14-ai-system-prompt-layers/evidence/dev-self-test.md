# 开发自测: ai-system-prompt-layers

## 环境

- 日期：2026-07-14
- 命令：`npm test` / `npm run lint` / `node .cursor/scripts/harness.js gate --json`

## 结果

- `npm test`：PASS（57/57，含 `ai-assistant-context`、`settings-secure` 迁移）
- `npm run lint`：PASS（lint ok）
- harness gate：`ok: true`，硬项无 BLOCKING

## 实现核对

1. 设置页标签为「用户偏好提示词」，读写 `userPrompt`
2. `buildSystemContent`：固定底座 + 可选偏好 + 动态上下文
3. `note.html` 发送 `history`；`buildChatMessages` 多轮拼装
4. 旧默认 `systemPrompt` → 空偏好；自定义保留
