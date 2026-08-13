# 开发自测报告

- 日期：2026-08-12
- Change：`polish-workflow-shelf-cards`
- npm test: PASS（`workbench-templates` 56/56）
- npm run lint: PASS
- 手动冒烟: 领域 chip 切换应即时过滤，不再 toast「已切换到…」、不重绘 Studio
- 备注：
  - 卡片视觉：图标井 / 字号层级 / chips
  - 性能：`selectConsoleDomain` 与 `selectMode` 解耦；同域点击短路；StickyIcons 只 mount 货架网格
