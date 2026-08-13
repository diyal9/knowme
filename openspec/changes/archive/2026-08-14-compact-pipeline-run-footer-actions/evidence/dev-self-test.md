## Dev self-test — compact-pipeline-run-footer-actions

- 日期：2026-08-12（补齐终态去「重跑」）
- Change：compact-pipeline-run-footer-actions
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 终态底栏无「重跑」；「过程日志」「刷新」并排；无审批/澄清时 `#wbRunnerActions` 隐藏
- 备注：按 spec「No terminal restart in review footer」去掉 `renderDaemonRunner` 中 failure/cancelled 的重跑按钮；契约测试改为 `doesNotMatch`。
