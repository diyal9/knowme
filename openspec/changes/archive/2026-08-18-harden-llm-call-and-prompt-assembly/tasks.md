## 1. 系统提示词

- [x] 1.1 新增 `knowme-system-prompt.ts` 分层块与 `assembleCorePrompt`
- [x] 1.2 `buildSystemContent` 按 tier/toolsEnabled 装配并截断用户偏好
- [x] 1.3 `prepareAgentGenerate` 传入 tier 与 toolsEnabled
- [x] 1.4 单测：chat 更短；全量底座字符串仍在 `ASSISTANT_BASE_PROMPT`

## 2. HTTP 与日志

- [x] 2.1 `requestAgentCompletion` 写 llm-request / llm-response
- [x] 2.2 `chatCompletionOnce` 走同一客户端
- [x] 2.3 `workbench-dispatch` 改为调用 `requestAgentCompletion`

## 3. 连通探测

- [x] 3.1 IPC `llm-probe`（8s）
- [x] 3.2 设置 AI 接口页按钮与结果
- [x] 3.3 preload / api 类型

## 4. 管线左栏 Daemon

- [x] 4.1 `clarifyNode` 与 `planPipelineComposerSend`
- [x] 4.2 `sendWorkbenchMessage` 在任务房不走 `aiGenerate`
- [x] 4.3 单测计划函数与对话 store
