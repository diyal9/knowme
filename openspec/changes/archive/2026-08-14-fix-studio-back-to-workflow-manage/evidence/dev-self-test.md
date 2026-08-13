# 开发自测报告

- 日期：2026-08-13
- Change：fix-studio-back-to-workflow-manage
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人重启后验证（管理工作流 → 编辑 → 右上角返回）
- 备注：
  - `leaveStudioToShelf` 按 `studioReturnState` 恢复；默认 `openManagePanel('workflows')`
  - 货架进入仍回货架；按钮文案区分「返回管理工作流」/「返回工作流」
