# SUPERSEDED — modularize-workbench-render-state

**状态**：作废（2026-08-17）

## 原因

本 change 目标为拆分遗留 `src/workbench.js`（surface-router / bind-chrome-events）。  
`refactor/renderer-react-ts` 已由 `migrate-renderer-react-ts` + `split-workbench-features-and-stores` 将工作台迁至 `src/renderer/features/*`，旧 `workbench.js` 产品面不再是主路径。

继续按本 tasks 抽 `src/workbench/*.js` 会与现行架构冲突。

## 处置

- tasks 全部标为不作
- 归档时保留本说明，不再实现
- 后续若再拆渲染状态，应针对 React feature/store 另开 change
