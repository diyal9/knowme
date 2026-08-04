# 开发自测报告

- 日期：2026-08-04
- Change：game-studio-work-partner-daemon
- npm test: **PASS** (909/909)
- npm run lint: **PASS**

## Electron 真机 UAT

- `node scripts/electron-uat-smoke.js`：**PASS**
- 主窗口无 uncaught error；Workbench trace 面板可见 scene/skill/connector/session/run
- 证据：`electron-uat-smoke.json`、`screenshots/electron-main-window.png`、`screenshots/electron-workbench-trace.png`

## Daemon 在线 E2E

- `node scripts/daemon-live-e2e.js`：**在线 PASS**（health → workflows → start → terminal）
- 任务终态：`failed: daemon exited with code 1`（executor 诚实失败，非客户端伪造）
- 证据：`daemon-live-e2e.json`

## 飞书只读

- `node scripts/feishu-auth-probe.js`：auth **PASS**，readApi **PASS**，writeBlocked **预期**
- 证据：`feishu-auth-probe.json`（不含 token）

## UAT 报告

- `node scripts/generate-game-studio-uat-docx.js` 已重新生成 DOCX，区分 PASS / 契约 PASS / BLOCKED
