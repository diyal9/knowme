# 开发自测报告

- 日期：2026-08-11
- Change：fix-capability-hub-double-refresh
- npm test: PASS（1637/1637）
- npm run lint: PASS
- openspec validate --strict: PASS
- 手动冒烟: 待制作人验收（打开能力 → 专家，确认卡片只入场一次；关闭再开无二次整格闪烁）
- 备注：
  - `loadCatalogAuxiliaries` 不再 `renderGrid`
  - `resumeFromHost` 同 Tab 仅刷新工作台绑定 + `renderDrawer`
  - 顺带修正 `workspace-capability-rail` 对 `isCapabilityHubDrawerKind()` park 路径的过期断言
