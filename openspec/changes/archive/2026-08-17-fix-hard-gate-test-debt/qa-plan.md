# QA Plan: fix-hard-gate-test-debt

## Smoke Scope

- `npm test` 全绿
- `npm run test:renderer` 全绿
- `npm run lint` 与 `npm run typecheck:renderer` 保持绿
- 抽查：`npm start` 仍能起工作台（防修测试误伤启动）

## 反模式

- 不得靠删断言 / 跳过整文件「变绿」而不记证据
- 不得未经制作人确认缩小硬门禁套件
