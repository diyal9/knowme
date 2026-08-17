# 开发自测报告

- 日期：2026-08-16
- Change：embed-settings-in-workspace
- npm test: PASS
- npm run lint: PASS
- npm run typecheck:renderer: PASS
- 手动冒烟: 已 npm start 热更，请制作人核对主窗口设置
- 备注：
  - 侧栏「设置」走 `AppRoute=settings`，主区渲染 `SettingsSurface embedded`，不再调用 `openSettingsWindow`
  - 再点设置回到助理
  - 文件栏「添加/管理内容源」走 `openSettingsSurface('sources')`
  - 工作台存在时 `openSettings()` 仍发 `workspace-open-settings` 并关闭独立窗
