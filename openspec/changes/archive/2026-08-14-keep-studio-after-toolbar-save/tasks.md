## 1. Workbench

- [x] 1.1 从 `saveStudioWorkflow` 成功路径移除 `setSurface('shelf')`，保留 `renderShelf` / dirty 清理 / toast
- [x] 1.2 更新 `leaveStudioToShelf` 注释：导航由 leave 负责，不再假设 save 已切货架

## 2. Verification

- [x] 2.1 补充静态测试：`saveStudioWorkflow` 函数体内不出现切货架
- [x] 2.2 `npm test` 与 `npm run lint`；写 `evidence/dev-self-test.md`
- [x] 2.3 写 `qa-plan.md`（工具栏保存留编排；保存后离开回货架）
