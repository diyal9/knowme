## Why

管线任务房和助理对话在已配置阿里云百炼 API 时仍会卡满 120 秒，才报「请求超时（120s），请检查网络或 Endpoint」。文案像没配 Endpoint，实际是聊天 POST 首包迟迟不来（DNS/死 VIP、Qwen3 默认思考模式不吐流）。

## What Changes

- 首包 15s 超时，错误带上 hostname，并写明 API 已配置。
- DashScope 的 Qwen 请求默认 `enable_thinking: false`，避免思考阶段长时间无 SSE。
- HTTP 请求固定 IPv4，降低 Windows 上死掉的 AAAA/VIP 挂死套接字。
- 已开始收流后的 120s 空闲超时与原错误文案保持不变。

### 验收标准

- 百炼 Endpoint + Key 已配置时，连不上或无首包在约 15s 内失败，而不是干等 120s。
- 错误文案包含 `dashscope.aliyuncs.com`（或当前 host）和「API 已配置」。
- `npm test` 覆盖 timeout 文案与 Qwen `enable_thinking` 注入。

### 非目标

- 不改管线左栏改走 Daemon/HITL（仍走同一套 LLM）。
- 不新增设置页「测试连接」按钮。
- 不引入系统代理 / Electron `net.fetch` 切换。

## Capabilities

无新用户表面；修复主进程聊天 HTTP。

## Impact

- `src/lib/main-llm-bridge.ts`
- `src/ipc/workbench-dispatch.ts`
- `tests/main-llm-bridge.test.js`
