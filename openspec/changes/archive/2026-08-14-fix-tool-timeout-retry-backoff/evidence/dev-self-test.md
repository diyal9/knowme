# 开发自测报告

- 日期：2026-08-12
- Change：`fix-tool-timeout-retry-backoff`
- npm test: PASS（1743/1743）
- npm run lint: PASS
- 手动冒烟: 建议重启后观察失败步骤是否内联显示「执行超时 / 命令执行失败（exit N）」等可读原因
- 备注：
  - 超时类退避：2s → 4s → … cap 30s
  - 外层工具超时 45s 后立即 `tool.failed` 并 `cancelProcessesForRun`
  - 失败摘要：`buildToolDisplaySummary` 输出友好原因；时间线错误步骤内联 hint
  - 修复 process registry 浅拷贝导致 status/child 不同步
