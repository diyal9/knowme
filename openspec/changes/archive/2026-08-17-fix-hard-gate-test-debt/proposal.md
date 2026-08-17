## Why

Story 完成硬门禁要求全量 `npm test` 与 `npm run test:renderer` 绿，但仓库仍有约 49 条 Node 单测与约 5 条 Vitest 失败（执行器协议版本、eval/team-runtime、工作台 overlay 等）。主进程 `create(ctx)` 重构已落地，这些失败与改名无关，却挡住三轮 main change 的 `/story-done`。现在单独开 Story，把硬门禁债与结构重构解耦。

## 目标用户

制作人 / 开发 / 测试：需要可信的 Story 完成门禁，避免「结构已绿但永远不能归档」。

## 验收标准

- `npm test` 全绿（或明确拆出并文档化的 `test:agent-*` 套件不再计入硬门禁，须改 harness 契约并获制作人确认）。
- `npm run test:renderer` 全绿。
- `npm run lint` 与 `npm run typecheck:renderer` 保持绿。
- 不借本 Story 再拆 `src/main` 的 `ctx` 袋。

## 非目标

- 不继续主进程 `create(ctx)` / IPC `pick` 结构重构。
- 不把 `ctx` 改成无共享袋纯函数。
- 不恢复便签窗、不改产品叙事。
- 不借机做大范围产品功能。

## What Changes

- 按失败簇修复或校准断言：`agent-run-executor*` / `SUPPORTED_PROTOCOL_VERSION` / `BUS_VERSION`、team-runtime、eval harness、audit 落盘路径、渲染层 overlay 规格等。
- 必要时更新 harness / gate-check 对「硬门禁包含哪些套件」的契约（须写进 design，默认优先修测试而非缩小硬门禁）。
- 产出 `evidence/test-report.md` 证明硬项绿。

## Capabilities

### New Capabilities

- `hard-gate-test-debt`: 恢复 Story 硬门禁所需的 Node 与 Vitest 测试基线

### Modified Capabilities

（无产品行为规格变更；本 change 以测试/门禁契约为主。）

## Impact

`tests/**`、`src/lib/agent-run-*`、`src/renderer/features/**` 相关规格测试、`.cursor/scripts/harness.js` / gate-check（若调整硬项范围）。
