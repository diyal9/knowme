## Why

按路由 `useEffect` 懒加载 CSS 多次导致工作台顶栏 / 管线「裸 HTML」：样式归属与加载条件脱节（`.wb-mode-tab` 曾只活在 `shelf.css`）。

## What Changes

- 顶栏抽出 `workbench-chrome.css`，由 AppShell **静态导入**
- 各 feature 模块顶部 `import` 自己的样式表，随 lazy chunk 到达
- 删除 AppShell `ensureSurfaceCss` 路由表
- 契约测试锁死上述关系

## Non-goals

- 不把 `workbench-layout` / `console.css` 巨石按行数锯开
- 不改产品布局语义
