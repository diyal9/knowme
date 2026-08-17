# 开发自测 — cohesion-first-file-budget

- 日期：2026-08-16
- Change：cohesion-first-file-budget
- npm test: 架构预算断言 1200 WARN / 2000 ERROR
- npm run lint: PASS（architecture ok；1200+ 为 WARN）
- 手动冒烟: 规范与门禁行为（1200 WARN / 2000 ERROR）
- 备注：白名单仅 `connectors/feishu-cli.ts`（>2000）。Hub 1699 行仅 WARN。
