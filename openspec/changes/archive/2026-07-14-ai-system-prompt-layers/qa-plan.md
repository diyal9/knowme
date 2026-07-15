# QA Plan: ai-system-prompt-layers

## Smoke Scope（必填）

- [x] 设置 → AI：标签为「用户偏好提示词」，可留空保存
- [x] 留空偏好时侧栏 AI 仍可正常流式生成（底座仍注入；IPC 路径未改 stream）
- [x] 填写领域/风格偏好后，回复明显受偏好影响（契约：system 含 `## 用户偏好`）
- [x] 连续两轮对话，第二轮能引用第一轮内容（`buildChatMessages` + `priorHistory`）
- [x] 旧默认 systemPrompt 用户升级后偏好框为空（迁移单测）

## Regression Scope

- [x] 无 API Key 时仍提示去设置（`ai-generate` 前置校验未改）
- [x] 知识库/记忆注入不报错（仍走 `getContextForAI` → `dynamicContext`）
- [x] 标题建议 `ai-suggest-title` 不受用户偏好干扰（仍用独立短 system）

## Anti-pattern Checks

- [x] 用户无法在 UI 里抹掉防幻觉底座（设置仅 `userPrompt`）
- [x] 偏好留空时不出现多余「用户偏好」空标题干扰模型（单测）
- [x] 超长历史不会把便签上下文完全挤掉（截断策略单测；本轮 user 始终追加）
