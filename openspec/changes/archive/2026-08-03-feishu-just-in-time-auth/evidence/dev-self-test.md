# 开发自测报告：feishu-just-in-time-auth

- 日期：2026-08-03
- 范围：把 lark-cli 权威 `missing_scopes` 信号从检测层贯通到对话内一键增量授权 + 授权后自动续跑
- 变更点：
  - `src/main.js`：工具失败结果的 `toolMessages` 增补 `code` / `missingScopes`，保证 grounding 拿到结构化信号（防文本截断丢失）。
  - `src/lib/feishu-grounding.js`：新增 `extractScopesFromText` / `collectMissingScopes`；`analyzeFeishuToolEvidence` 返回 `missingScopes`；`buildAuthFailureNotice` 改为 scope 感知（友好能力名 + CTA 编码 `knowme://feishu/auth?scopes=…`）；4 个 authFailed 分支与 `buildReadFailureNotice` 全部接入（含 401/403 无 scope 时的通用重新授权回退）。
  - `src/lib/connectors/feishu-cli.js`：`parseMissingScopeError` / `describeMissingScopes` / `getGrantedUserScopes`；`executeFeishuRead` 返回结构化 `missing_scope`。
  - `src/lib/connectors/feishu-auth.js`：`buildAuthLoginAttempts(extraScopes)` 增量授权、`describeScopeCapabilities`、`startFeishuAuth(opts.scopes)`。
  - `src/preload.js` / `src/main.js` IPC：透传 `scopes`。
  - `src/workspace-agent.js` / `src/workspace.html`：CTA 支持 `?scopes=`，按钮携带 `data-feishu-scopes` + 可展开原始 scope；点击按增量 scope 拉起授权，成功后自动续跑原始提问。
- 定向测试：`node --test "tests/feishu-grounding.test.js" "tests/feishu-cli.test.js"` PASS
- `npm test`：PASS（726/726）
- `npm run lint`：PASS（含 `script-scope ok`）
- 手动冒烟：制作人在真实"个人文档权限不足"场景实测通过（见 `acceptance.md`）
- 门禁状态：开发自测 ✅ / 制作人验收 ✅ / 测试 QA ✅（见 `evidence/test-report.md`）/ `/gate-check` 硬项 ✅
