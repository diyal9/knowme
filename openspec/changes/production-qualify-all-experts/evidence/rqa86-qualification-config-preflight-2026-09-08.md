# RQA86：资格套件配置前置门禁

日期：2026-09-08

## 发现

生图资格套件 RQA69 声明了 `pango-image-mcp`，服务地址来自 `KNOWME_PANGO_MCP_URL`。当前隔离环境的连接器记录虽然有 `enabled=true` 和工具 allowlist，但 MCP URL 为空，因此并不具备可执行的 Provider。

旧行为仍会启动 Electron、创建任务，随后由运行时进入 `needs_input / capability_unavailable`。这会制造重复的环境阻塞任务，并让套件的“已配置”描述看起来比实际状态更完整。

## 修正

`expert-qualification-live.js` 新增通用的 `suiteConnectorConfigurationIssues` 前置检查：

- HTTP/streamable MCP 必须有非空 `mcp.url` 或对应 `urlFromEnv` 环境变量；
- stdio MCP 必须有非空启动命令；
- 缺配置时在 Electron 启动前终止，并明确指出连接器、缺失字段和下一步；
- 不创建任务、不生成执行记录、不将环境阻塞混入专家资格样本。

## 验证

- `tests/expert-qualification-live.test.js`：10/10 通过；
- RQA69 当前命令实测：明确输出 `连接器 pango-image-mcp 需要设置环境变量 KNOWME_PANGO_MCP_URL`，并确认没有启动 Electron 任务；
- `npm run lint`：通过（仅保留既有 advisory 文件行数警告）；
- `npm run typecheck:renderer`：通过；
- 全量 `npm test` 仍有 1 个既有 `tests/capability-pack.test.js` 失败，具体为 `legacy scene-only pack installs without catalog skills`，不是本轮资格脚本改动造成，需另立回归处理。

这项修正提高了资格证据的真实性，但没有替代真实 Provider 配置，也没有给任何专家授予生产资格。
