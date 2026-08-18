## Why

对话超时现场证明：系统提示词每轮整包塞入（含工具百科），传输层不可观测，管线任务房左栏还在打百炼。需要一套按意图裁剪的 KnowMe 提示词装配，并把调用链路收口成可探测、可诊断、任务房走 Daemon 的路径。

## What Changes

- 系统提示词分层：身份 / 硬规则 / 工具 / 输出 / 场景 / 用户偏好；`chat` 档不带工具百科，用户偏好按档截断。
- 请求级脱敏日志：host、model、status、latency、timeout phase；不写 Key。
- 唯一 HTTP 客户端：`requestAgentCompletion` 服务流式、一次性、workbench-dispatch。
- 设置页 8s 连通探测。
- 管线任务房 composer 走 Daemon clarify/gate，不再 `aiGenerate`。

### 验收标准

- `?` 级 chat 的 system 不含 `feishu.search_docs` 工具专章，仍含 KnowMe 身份与禁止幻觉。
- 一次失败的聊天请求在 llm 日志里能看到 host 与耗时。
- 设置 → AI 接口「测试连接」8 秒内给出通/不通。
- 管线房发送不调用 `aiGenerate`。

### 非目标

- 不切换 Electron `net.fetch` / 系统代理。
- 不引入第三方 LLM SDK。
- 不改 Daemon 协议。

## Capabilities

- `office-assistant`：提示词装配与连通探测。
- `workbench-workflow-shelf-layout` / 管线任务房：左栏 Daemon 对话。

## Impact

- `src/lib/knowme-system-prompt.ts`（新）
- `src/lib/ai-assistant-context.ts`、`agent-generate-prepare.ts`
- `src/lib/main-llm-bridge.ts`、`src/ipc/workbench-dispatch.ts`
- `src/ipc/ai-assist.ts`、设置页
- `store-workbench-dialogue.ts`、RunState
