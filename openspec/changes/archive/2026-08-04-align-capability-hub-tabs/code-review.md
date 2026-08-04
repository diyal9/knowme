# Code Review: align-capability-hub-tabs

## 范围

- `src/capability-hub.html` / Hub 嵌入模式样式
- `src/workspace.html` drawer 顶部栏与 iframe 深链
- `tests/capability-hub.test.js`

## 结论

- [x] 通过
- 变更聚焦 UI 对齐，未改动 Catalog DTO / IPC 契约
- embedded 与 standalone 模式分支清晰
- 无安全或性能回归风险

## 备注

- 2026-08-04 follow-up：补 Electron 真机截图 `electron-hub-outer-topbar.png`
