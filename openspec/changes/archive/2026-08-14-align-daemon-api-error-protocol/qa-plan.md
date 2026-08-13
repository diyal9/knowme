# QA Plan: align-daemon-api-error-protocol

## Smoke Scope

- [ ] 单元：统一错误信封 `detail.code` / 默认文案 / 鉴权 vs 权限码
- [ ] 文档：`docs/daemon/API.md` 版本与信封章节存在；README 含 KnowMe 端点清单
- [ ] 回归：既有 daemon client 用例（overview / createAndRun / auth header）仍通过
- [ ] 手工（可选）：对本机 `:8010` 请求不存在 slug，确认 toast/返回码为 `task_not_found` 类可读提示

## Anti-patterns

- 不要把 `task_forbidden` 弹成「去设置里填授权码」
- 不要在错误结果中回传 token
