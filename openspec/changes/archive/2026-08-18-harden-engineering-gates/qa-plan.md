# QA Plan — harden-engineering-gates

## Smoke Scope

- [x] `npm run check` 在 package.json 存在且串行硬项
- [x] `harness gate --json --change harden-engineering-gates` 软项只扫该 change
- [x] 未指定 --change 时软项为 ACTIVE-CHANGE-SUMMARY 而非 40+ 条
- [x] `npm run openspec:health --json` 输出 active_count
- [x] capability-hub 等懒表面单测可用 `renderApp`

## Out of scope

- 未完成 restore-* 全量归档
- Playwright 进硬门禁
