# 开发自测报告

- 日期：2026-08-13
- Change：align-daemon-hitl-status-with-webui
- npm test: PASS（1821/1821）
- npm run lint: PASS
- 手动冒烟: 单测覆盖 idle+pending_clarifications → waiting；与 WebUI「待处理」对齐
- 备注：
  - `resolveDaemonRuntimeState`：job.completed + status.idle + clarifications → waiting / non-terminal
  - Outcome pill：等待优先于完成
  - brief / progress card / surface bucket 同步 HITL 优先
