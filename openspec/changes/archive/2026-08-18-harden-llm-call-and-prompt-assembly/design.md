## 系统提示词

- 稳定前缀：身份 + 硬规则（可缓存）。
- 按 `tier`：`chat` 不注入飞书/网页工具专章与 suggestion schema；`assist`/`retrieval` 在 `toolsEnabled` 时注入。
- 用户偏好按档截断（chat 400 / assist 1200 / retrieval 2000 字符）。
- 全量拼接仍导出为 `ASSISTANT_BASE_PROMPT`，供指纹与存量测试。

## HTTP

- `requestAgentCompletion` 为唯一 POST；开始/结束写 `logger.llm`。
- `chatCompletionOnce` 与 `workbench-dispatch` 只包这一函数。
- 探测：`max_tokens=4`，首包+空闲 8s。

## 管线房

- `get().run && !expertRoom` 时 `planPipelineComposerSend`：
  - 有 `clarifyNode` → `workbenchDaemonClarify`
  - 有 `gateNode` 且 hitl → gate `revise` + comment
  - 否则本地回执，不打 LLM
