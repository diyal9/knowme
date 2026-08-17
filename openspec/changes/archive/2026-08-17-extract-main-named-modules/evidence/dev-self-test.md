# 开发自测报告

- 日期：2026-08-16
- Change：extract-main-named-modules
- npm test: 本 change 相关 `split-entry-ipc-workbench` / `assistant-output-style` PASS。全量 `npm test` 仍有约 46 条失败（agent-run-executor / team-runtime `SUPPORTED_PROTOCOL_VERSION` 等），与主进程文件重命名无关，既有债（见 cohesion-first-file-budget 非目标）。
- npm run lint: PASS（architecture WARN 仅 Hub / feishu-cli 存量）
- npm run typecheck:renderer: PASS
- 手动冒烟: 未在本会话拉起 Electron；结构门禁已断言无 `part-*`、组合根 `attach`、无内联 IPC
- 备注：`src/main/part-*.ts` 已删除；加载序 boot → agent-runtime → shell → knowledge → workbench
