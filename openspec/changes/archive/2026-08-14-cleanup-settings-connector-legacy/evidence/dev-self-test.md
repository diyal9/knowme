# 开发自测报告

- 日期：2026-08-06
- Change：`cleanup-settings-connector-legacy`
- OpenSpec strict validate：PASS
- 定向回归：PASS（`node --test tests/settings-connector-cleanup.test.js`，3/3）
- `npm test`：PASS（1269/1269）
- `npm run lint`：PASS（lint ok；script-scope ok）
- IDE lint：PASS（本次修改文件无诊断）
- Electron 启动冒烟：PASS（应用正常启动；无 uncaught error）

## 覆盖范围

- 设置页不再包含飞书待审批草稿 DOM、刷新函数和批准/拒绝事件处理。
- renderer/preload/main 不再包含 `connectors-drafts`、`connectors-approve-draft` 旧链路。
- Agent 对话仍保留 `toolApproveDraft`、审批卡和 `connectorsCreateDocDraft` 草稿创建能力。
- `mcp-default` 仅用于专用公司 MCP 表单的内部读写，不再进入通用连接器列表。

## 备注

- 用户已有草稿数据未删除。
- Electron 控制台仅有开发态既有 CSP 安全警告，本次未引入业务报错。
