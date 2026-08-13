## Why

连接设置页同时展示飞书待审批草稿和内部 `mcp-default` 占位行，重复了 Agent 对话审批与专用 MCP 配置区，并暴露了用户不应理解的内部标识。现在需要收紧界面职责，让设置页只管理连接配置，写入确认留在发起操作的 Agent 上下文中。

## What Changes

- 从设置页移除“待确认的飞书写入”草稿箱及其审批事件处理。
- 删除仅供该旧入口使用的 renderer API 与废弃主进程 IPC 代理。
- 从设置页通用连接器列表隐藏内置 `mcp-default` 占位项，仅保留“公司 MCP”专用配置区。
- 保留统一草稿存储、Agent 对话审批卡、统一 `tool-approve-draft` IPC 和 MCP 运行时能力。
- 增加回归测试，防止设置页重新出现审批入口、废弃 IPC 或内部连接器标识。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `connector-sdk`: 明确连接设置界面只负责配置与连接状态，不承载具体写入审批，也不得展示内置连接器的内部占位标识。

## Impact

- 目标用户：使用飞书连接器或公司 MCP 的普通 KnowMe 用户。
- 体验价值：减少重复入口和技术术语泄漏，确保高风险操作在其发起上下文中完成确认，降低误操作与上下文丢失。
- 商业化价值：提升连接器配置与 Agent 执行体验的一致性，降低企业用户理解和支持成本。
- 受影响代码：`src/settings.html`、`src/preload.js`、`src/main.js` 及相关测试。
- 验收标准：
  - 设置页不再展示飞书待写入/权限申请草稿或批准、拒绝按钮。
  - Agent 对话中的批准、拒绝能力保持可用。
  - 设置页不再出现 `mcp-default · mcp` 通用列表项；公司 MCP 配置区仍可加载和保存配置。
  - renderer 不再暴露 `connectorsDrafts`、`connectorsApproveDraft`，主进程不再注册对应废弃 IPC。
  - 测试与 lint 通过。
- 非目标（Non-goals）：
  - 不删除用户已有待审批草稿数据。
  - 不改动飞书草稿状态机、外部写入实现或 MCP Host。
  - 不重设计 Capability Hub 或工作台全局 draft inbox。
