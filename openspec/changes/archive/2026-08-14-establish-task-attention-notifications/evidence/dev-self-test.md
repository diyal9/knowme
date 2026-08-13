# Dev self-test: establish-task-attention-notifications

- Date: 2026-08-13
- Change: establish-task-attention-notifications

## Checks

| Check | Result |
|------|--------|
| `npm test` | PASS |
| `npm run lint` | PASS |
| FAB list + pulse hooks | OK |
| Daemon HITL publish/clear | OK |
| Desktop toast HTML + IPC | OK |
| No Session resume in FAB | OK |

## Manual smoke

1. 前台跑 Daemon 到 gate/clarify → FAB 红点+脉冲；点开停动画
2. hide 到托盘后再进 HITL → 右下角暗色 toast；点击回工作台
