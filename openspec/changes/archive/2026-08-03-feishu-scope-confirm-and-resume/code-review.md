# 代码评审: feishu-scope-confirm-and-resume

## 结论

通过。权限画像与申请列表对齐；设置页知情确认；对话深链不再误走 `open-external`；runtime scope 有净化与降级。

## 变更范围

| 文件 | 变更 |
|---|---|
| `src/lib/connectors/feishu-auth.js` | scope 列表对齐、plan/sanitize、降级阶梯、signature |
| `src/lib/connectors/index.js` | status 附带 `permissionPlan` |
| `src/lib/connectors/feishu-cli.js` | `doc_kb_suggest` 全失败 → `missing_scope` |
| `src/settings.html` | 确认面板 + 缺口收敛判定 |
| `src/workspace-agent.js` | 深链拦截、`runFeishuAuthInChat`、续跑 |
| `tests/*` | 一致性、降级、拦截、cli/grounding 回归 |

## 检查项

| 项 | 结论 |
|---|---|
| 画像 vs 申请不变量 | 有单测锁定 |
| XSS | 确认面板与授权文案经 `escHtml` |
| 假成功 | baseline/signature 防增量假绿 |
| 深链安全 | `knowme://` 不进入 shell.openExternal |
| Token 持久化 | 仍由 lark-cli/OS，KnowMe 不落盘 |
