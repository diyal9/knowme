## 1. Stabilise Hub paint paths

- [x] 1.1 调整 `loadCatalogAuxiliaries`：完成后仅 `renderDrawer()`，不再 `renderGrid()`
- [x] 1.2 调整 `resumeFromHost` 同 Tab 路径：只刷新工作台绑定并 `renderDrawer()`，移除先行 `renderGrid` 与 soft `loadCatalog`
- [x] 1.3 更新 `tests/capability-hub.test.js` 锁定上述契约

## 2. Verification

- [x] 2.1 运行相关测试与 `npm test` / `npm run lint`，写入 `evidence/dev-self-test.md`
