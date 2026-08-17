# 开发自测报告

- 日期：2026-08-16
- Change：split-lib-god-files-by-domain
- npm test: PASS
- npm run lint: PASS（含 architecture ok；hub 再拆后复跑）
- 手动冒烟: 未重启 Electron（纯 lib 结构拆分，IPC 路径未改）
- 备注：
  - 白名单 43 → 35。已移出：catalog / scheduler / launch-model / web-fetch / process-tools / mcp-host / bootstrap / feishu-auth。
  - `capability-hub-service` 1700 → 1343（映射层 `capability-hub-map.ts`）。
  - 专家库命名测试改为断言 `hub-tab`（旧 `wb-mode-tab` 已随 HTML 工作台退役）。
