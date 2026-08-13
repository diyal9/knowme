# 开发自测报告

- 日期：2026-08-13
- Change：keep-studio-after-toolbar-save
- npm test: PASS（fail 0）
- npm run lint: PASS
- 手动冒烟: 代码路径已改；需本地重启后点工具栏保存确认仍留在编排
- 备注：根因是 `saveStudioWorkflow` 成功后无条件 `setSurface('shelf')`；已解耦，离开仅由 `leaveStudioToShelf` 导航
