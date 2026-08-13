# Windows Manual Smoke — strengthen-workbench-tool-surface

> **状态：待制作人/测试真机执行**（不得伪造无凭据通过）

## 前置条件

- Windows 10/11 真机
- KnowMe 开发构建可启动（`npm start`）
- 可选：飞书连接器已授权
- 可选：Playwright MCP server 已配置（Capability Hub → MCP）

## 用例 A — 文件写审批卡

1. 绑定本地内容源文件夹
2. 在 Agent 模式触发 `apply_patch` 或 `write_file`（通过对话或 eval fixture）
3. **期望**：时间线出现「待确认」审批卡；未批准前磁盘 hash 不变
4. 点击「批准」→ 文件变更生效；可选「拒绝」→ 无副作用

## 用例 B — 飞书 draft（需凭据）

1. 飞书连接器 enabled + allowlist 含 `feishu.draft_send_message`
2. 触发 IM 消息 draft
3. **期望**：draft inbox / 审批卡 pending；spy 或网络面板 **0 次**真实写 API（未批准前）
4. 批准后 CLI apply 成功（或明确权限错误，不得 UI 假成功）

## 用例 C — Playwright MCP（需 MCP 安装）

1. Hub 配置 Playwright MCP（stdio 或 streamable-http）
2. 触发 `browser_navigate` + `browser_snapshot` 到 allowlist 域名
3. **期望**：snapshot 返回；非 allowlist 域名返回 `scope_denied`

## 用例 D — legacy 回滚

1. 设置 `KNOWME_TOOL_SURFACE=legacy` 启动
2. **期望**：无 write/process/orchestration 新工具投影；只读文件 + 原有 Feishu draft 仍可用

## 记录模板

| 用例 | 执行人 | 日期 | 结果 | 备注 |
|---|---|---|---|---|
| A 文件审批 UI | 测试 | 2026-08-06 | **部分 PASS** | IPC roundtrip + mock 卡；live Agent 触发 SKIP |
| B 飞书 draft | 测试 | 2026-08-06 | **SKIP** | `FEISHU_CONFIG=NO`，无用户授权真实写 |
| C Playwright | 测试 | 2026-08-06 | **SKIP** | `MCP_DIR=NO`，无 Playwright MCP 配置 |
| D legacy | 测试 | 2026-08-06 | **PASS** | node + Electron legacy 场景 |
