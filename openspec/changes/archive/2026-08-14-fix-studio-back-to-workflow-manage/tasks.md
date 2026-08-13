## 1. 来源捕获与离开恢复

- [x] 1.1 增加 `studioReturnState`；在 `openOrchestration` 从非 studio 切入时捕获 `manage`/`shelf`
- [x] 1.2 改写 `leaveStudioToShelf`：按来源 `openManagePanel('workflows')` 或 `setSurface('shelf')`；默认管理
- [x] 1.3 `syncHeadActionButton`：按来源设置「返回管理工作流」/「返回工作流」文案

## 2. 测试与自测

- [x] 2.1 更新 `tests/keep-studio-after-toolbar-save.test.js` 离开目标断言
- [x] 2.2 补充契约：管理来源离开走 `openManagePanel('workflows')`
- [x] 2.3 `npm test` / `npm run lint`；写 `evidence/dev-self-test.md`
