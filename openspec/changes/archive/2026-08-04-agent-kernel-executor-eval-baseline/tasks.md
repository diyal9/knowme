# Tasks: agent-kernel-executor-eval-baseline

## 1. 执行内核骨架

- [x] 1.1 新建 `src/lib/agent-run-executor.js`：导出 `RunPhase` 枚举、`AgentRunExecutor.run(input, ports, emit)` 骨架与 `runPhases` 记录
      → spec: `agent-run-executor` / Explicit run phase state machine
- [x] 1.2 新建 `src/lib/agent-run-ports.js`（或同文件）：定义 `RunPorts` 契约（llm/tools/context/session/settings/signal/clock）
      → spec: `agent-run-executor` / Injectable ports
- [x] 1.3 实现 PREPARE（settings/api 校验）、ERROR/CANCELLED 终态与 phase 边界 abort 检测
      → spec: `agent-run-executor` / Cancelled / Unhandled failure
- [x] 1.4 单元测试 `tests/agent-run-executor.test.js`：mock ports 完成 chat-simple 路径
      → spec: `agent-run-executor` / Mock LLM in unit test

## 2. 迁移主循环逻辑（渐进）

- [x] 2.1 从 `main.js` 识别并迁移 MODEL↔TOOL 循环、预算（`llmUsage.adaptiveBudget`/`expandBudget`）、`toolCallKey` 去重至 executor
      → spec: `agent-run-executor` / Tool loop transitions
- [x] 2.2 接入 `agent-recovery`：`RECOVER` 阶段与重试/反思逻辑
      → spec: `agent-run-executor` / Recoverable tool error
- [x] 2.3 接入 `agent-verify`：`VERIFY` 阶段与 plan partial finalize
      → spec: `agent-run-executor` / Plan incomplete triggers VERIFY
- [x] 2.4 实现 FINALIZE、PERSIST（session/usage/metrics 写回）；emit 兼容既有 stage/tool 事件
      → spec: `agent-run-executor` / Stream events remain compatible
- [x] 2.5 `main.js` 新增 `buildProductionRunPorts()` adapter；保留 legacy 路径
      → design: D3 / D4

## 3. Feature flag 与 IPC 薄层

- [x] 3.1 读取 `KNOWME_AGENT_EXECUTOR`（`legacy`|`kernel`，默认 Phase B 前 `legacy`，完成后 `kernel`）
      → spec: `agent-run-executor` / Legacy fallback flag
- [x] 3.2 `ai-generate` handler 在 kernel 模式下委托 executor；`activeAgentRuns`/`ai-cancel-run` 行为不变
      → spec: `agent-run-executor` / Kernel path selected
- [x] 3.3 stage/tool emit 增加 `runPhase` 字段（不改变 title/summary）
      → spec: `agent-thinking-timeline` / Run phase metadata

## 4. Mock-replay Eval harness

- [x] 4.1 新建 `tests/fixtures/agent-eval/*.json` 与 `tests/agent-eval-harness.test.js`（或 `tests/agent-eval/`）
      → spec: `agent-eval-harness` / Fixture-driven mock replay
- [x] 4.2 实现 mock LLM script replay（按 call index）与 mock tool script
      → spec: `agent-eval-harness` / Replay multi-round tool fixture
- [x] 4.3 首批 7 个 fixture：`chat-simple`、`knowledge-tool`、`tool-recovery`、`plan-incomplete`、`grounding-inject`、`cancel-mid-model`、`error-no-api-key`
      → spec: `agent-eval-harness` / Representative baseline scenarios
- [x] 4.4 结构化 report 断言（terminal/phases/toolCalls/planEval）；失败打印 diff
      → spec: `agent-eval-harness` / Structured eval report output
- [x] 4.5 确认 eval 用例被 `npm test` 收录；无 API Key 环境可绿
      → spec: `agent-eval-harness` / CI runs without real API

## 5. 指标与文档

- [x] 5.1 （可选）`scripts/agent-eval.js` 输出 JSON report 至 `evidence/eval-report.json`
      → spec: `agent-eval-harness` / Structured eval report output
- [x] 5.2 写 `evidence/dev-self-test.md`：legacy vs kernel 冒烟、eval 报告摘要
- [x] 5.3 更新 `qa-plan.md` Smoke Scope 勾选项（开发自测时填）

## 6. 门禁

- [x] 6.1 `npm test` 全绿（含 agent eval）
- [x] 6.2 `npm run lint` 无 error
- [x] 6.3 `openspec validate agent-kernel-executor-eval-baseline --strict` 通过
- [x] 6.4 本地 `npm start`：chat / 检索 / 取消 — 无控制台报错，时间线正常（kernel 模式）
