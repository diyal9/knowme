# 开发自测报告

- 日期：2026-08-04
- Change：`agent-kernel-executor-eval-baseline`
- Preflight：`node .cursor/scripts/harness.js preflight --json` → ok
- npm test：**PASS**（967 tests，含 agent-run-executor + agent-eval-harness 共 13 项新增）
- npm run lint：**PASS**
- openspec validate --strict：**PASS**
- 手动冒烟（6.4 / qa-plan S1–S4）：**未在本会话执行**（留制作人 kernel/legacy 对比验收）

## Eval 报告摘要

`node scripts/agent-eval.js` → `evidence/eval-report.json`

| fixture | terminal | toolCalls | 关键阶段 |
|---|---|---|---|
| chat-simple | DONE | 0 | PREPARE→CONTEXT→MODEL→PERSIST |
| knowledge-tool | DONE | 1 | +TOOL |
| tool-recovery | DONE | 2 | +RECOVER |
| plan-incomplete | DONE | 2 | +VERIFY |
| grounding-inject | DONE | 0 | CONTEXT |
| cancel-mid-model | CANCELLED | 0 | MODEL→CANCELLED |
| error-no-api-key | ERROR | 0 | PREPARE→ERROR |

全部 7/7 PASS，零网络、零 API Key。

## Kernel / Legacy

| 项 | 状态 |
|---|---|
| 默认 executor | `kernel`（`KNOWME_AGENT_EXECUTOR` 未设或 `kernel`） |
| 回滚 | `KNOWME_AGENT_EXECUTOR=legacy` 走原内联循环（`@deprecated legacy-ai-generate-loop`） |
| IPC | `activeAgentRuns` / `ai-cancel-run` 未改契约 |
| runPhase | stage/tool 事件 payload 含 `runPhase`，title/summary 不变 |

## 备注

- CONTEXT 装配仍在 main.js prepare 段；kernel 在上下文就绪后委托 executor（渐进迁移 D4 Phase B）。
- 未修改其他活跃 change 工件或无关模块。
