# Tasks: feishu-just-in-time-auth

- [x] 1. `feishu-cli.js` 解析 lark-cli 结构化 `missing_scope` 错误（`parseMissingScopeError` / `describeMissingScopes` / `getGrantedUserScopes`），`executeFeishuRead` 返回 `code:'missing_scope'` + `missingScopes`
- [x] 2. `feishu-auth.js` 支持增量授权：`buildAuthLoginAttempts(extraScopes)`、`describeScopeCapabilities(scopes)`、`startFeishuAuth(opts.scopes)`
- [x] 3. `main.js` 工具失败结果 `toolMessages` 携带 `code`/`missingScopes`；`connectors-feishu-auth-start` 透传 `options.scopes`
- [x] 4. `preload.js` `connectorsFeishuAuthStart(options)` 透传 `scopes`
- [x] 5. `feishu-grounding.js` 从失败证据提取 `missingScopes`，`buildAuthFailureNotice` 改为 scope 感知（友好能力名 + `?scopes=` 编码 CTA），接入 4 个 authFailed 分支 + `buildReadFailureNotice`
- [x] 6. `workspace-agent.js`/`workspace.html`：CTA 解析 `?scopes=`、按钮携带 `data-feishu-scopes` + 可展开原始 scope；点击增量授权、成功后自动续跑原始提问
- [x] 7. 测试：scope 提取/结构化优先/CTA 编码/scope 感知与回退/read 失败 CTA + QA 边界回归
- [x] 8. `npm test`、`npm run lint`，补开发自测 / QA 证据
