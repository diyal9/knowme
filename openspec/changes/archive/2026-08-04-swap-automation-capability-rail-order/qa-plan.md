# QA Plan: swap-automation-capability-rail-order

## Smoke Scope（必填）

- [x] Electron 真机左 Rail 顺序：办公助理 → 工作台 → 能力 Hub → （分隔）→ 自动化
- [x] 能力 Hub 位于主导航分组，自动化位于 toolbar 分组
- [x] 各入口 aria-label / title 保持正确
- [x] 点击各 Rail 按钮可正常切换表面

## Regression Scope

- [x] rail 顺序契约测试通过
- [x] npm test / lint 通过

## Anti-pattern Checks

- 自动化与能力 Hub 顺序回退或视觉分组混淆
- 静态预览 `window.api` 缺失误报为真机错误
