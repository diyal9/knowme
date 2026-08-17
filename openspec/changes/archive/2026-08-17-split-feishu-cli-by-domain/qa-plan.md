# QA Plan: split-feishu-cli-by-domain

## Smoke Scope（必填）

- [ ] `npm run lint` 无 error；`feishu-cli.ts` 不在 oversized 白名单
- [ ] `npm test` 绿（含 `feishu-cli.test.js`、`feishu-meeting-selection.test.js`、`fake-feishu-write.test.js`、`tool-surface-closed-loop.test.js`）
- [ ] `require('./feishu-cli')` 导出键与拆前一致（tool-runtime / boot 无需改）

## Regression Scope

- [ ] `executeFeishuRead` missing_scope 结构化错误仍返回
- [ ] 会议/IM/今日优先级/文档 KB 工作流函数仍可被测试 mock spawn 调用

## Anti-pattern Checks

- [ ] 未改 IPC / Daemon
- [ ] 未复制第二份 feishu 逻辑到 renderer
