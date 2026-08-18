# QA Plan — push-strict-score-to-96

## Smoke Scope

- [x] 助理默认路由可发送、时间线出现（`assistant.spec` 28）
- [x] 100 条消息走 `agent-message-virtuoso`
- [x] `npm run perf:strict-bench` 输出当前首屏 CSS 小于基线 workspace-agent.js（ratio 0.2388）
- [x] 切工作台 / Hub / 知识网表面仍可测（现有 spec 绿）
- [x] renderer typecheck + vitest 硬项绿（tsc PASS；241 tests）

## Out of scope

- 便签分屏/版本编辑器
- Playwright 进入硬门禁
- restore-game-studio 未勾诚实缺口
