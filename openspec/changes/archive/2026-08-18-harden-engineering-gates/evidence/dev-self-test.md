# 开发自测 — harden-engineering-gates

- 日期：2026-08-18
- 命令：`npm run check` 分项、`npm run openspec:health`、`npm run test:renderer`

## 硬项

| 项 | 结果 |
|----|------|
| `npm test` | PASS 1586 / skip 51 / fail 0 |
| `npm run lint` | PASS（architecture / nocheck / lint / script-scope） |
| `npm run test:renderer` | PASS 41 files / 225 tests |
| `npm run typecheck:renderer` | PASS |

## OpenSpec

- 已归档：`push-refactor-score-to-90`、`lift-low-score-dimensions`、`speed-up-workspace-first-paint`、`narrow-windows-gpu-disable`、`boost-renderer-runtime-perf`、`closeout-assistant-dialogue-parity` → `openspec/changes/archive/2026-08-18-*`
- `openspec:health`：active_count=38（restore-* 与历史未收口项仍在）；缺 qa-plan=6、缺 code-review=33。脚本可扫，不进 `npm run check`。
- gate 未指定 `--change` 时只出 ACTIVE-CHANGE-SUMMARY。

## 可测性

- Vitest 下 AppShell 表面同步解析；生产仍 `React.lazy`
- 非当前路由不挂工作台块
- `renderApp` 等待 `km-surface-pending` 消失
- capability-hub：8/8 PASS
