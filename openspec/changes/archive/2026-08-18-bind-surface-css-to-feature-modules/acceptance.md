# 制作人体验验收: bind-surface-css-to-feature-modules

## 核心路径
- [x] 工作台顶栏 / 三 Tab 有样式（非浏览器默认按钮）
- [x] 货架 / 管线 / 任务房表面自带 CSS，不靠壳 `ensureSurfaceCss`
- [x] AppShell 只静态导入 `workbench-chrome.css`

## 体验标准
- 切表面时样式随模块加载，不出现无样式闪一下后靠 effect 补 CSS

## 验收结论
- [x] 通过
- 验收人：制作人（对照 `surface-css-contract.spec` + Electron 核心路径 smoke）
- 日期：2026-08-18
