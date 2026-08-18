## 1. Sync tab paint on surface switch

- [x] 1.1 `setSurfaceMode`：switched 时同步恢复目标面 `openSessionIds` 并 `renderSessionTabs`，再 `renderChat` / 异步 activate
- [x] 1.2 `activateSurfaceSession`：首次 `await` 前再次确保已 `renderSessionTabs`（防其它入口漏同步）

## 2. Tests and gate

- [x] 2.1 `tests/workspace-agent.test.js` 断言同步重绘路径存在
- [x] 2.2 跑 `npm test` 与 `npm run lint`
