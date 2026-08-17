# 开发自测报告

- 日期：2026-08-17
- Change：`split-agent-run-and-studio-by-domain`
- 分支：`refactor/renderer-react-ts`

## 门禁

| 检查 | 结果 |
|------|------|
| 定向测试（8 套件） | PASS — 110/110 |
| `npm run lint` | PASS — architecture ok |
| Studio 拆分 | **不作**（见 design.md） |

## 定向测试命令

```bash
node -r ./scripts/register-ts.js --test \
  tests/agent-run-executor.test.js \
  tests/agent-run-executor-grounding.test.js \
  tests/agent-team-runtime-core.test.js \
  tests/agent-team-runtime-integration.test.js \
  tests/agent-runtime-production-readiness.test.js \
  tests/workbench-studio-model.test.js \
  tests/workbench-studio-canvas.test.js \
  tests/workbench-studio-free-graph.test.js
```

## 文件行数

| 文件 | 行数 |
|------|------|
| `src/lib/agent-run-executor.ts` | 374 |
| `src/lib/agent-run-executor/constants.ts` | 13 |
| `src/lib/agent-run-executor/hints.ts` | 36 |
| `src/lib/agent-run-executor/result.ts` | 32 |
| `src/lib/agent-run-executor/phases-prepare-context.ts` | 138 |
| `src/lib/agent-run-executor/phases-model-tool.ts` | 651 |
| `src/lib/agent-run-executor/phases-ground-persist.ts` | 192 |
| `src/lib/agent-run-manager.ts` | 116 |
| `src/lib/agent-run-manager/constants.ts` | 56 |
| `src/lib/agent-run-manager/transitions.ts` | 190 |
| `src/lib/agent-run-manager/lifecycle.ts` | 546 |
| `src/lib/agent-run-manager/children.ts` | 143 |
| `src/lib/agent-run-manager/recovery.ts` | 145 |

## 备注

- 原 `agent-run-executor.ts` ~1089 行、`agent-run-manager.ts` ~1049 行已拆完。
- 手动冒烟：未启动 Electron（纯 lib 重构）；测试覆盖 executor/manager/runtime/studio 回归。
