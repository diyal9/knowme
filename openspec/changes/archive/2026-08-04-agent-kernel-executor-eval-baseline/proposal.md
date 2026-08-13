# Proposal: agent-kernel-executor-eval-baseline

## Why

KnowMe 的 Agent 核心循环仍内嵌于 `src/main.js` 的 `ai-generate` IPC handler（约 1000+ 行），上下文装配、模型往返、工具执行、恢复、计划自验证与持久化耦在同一闭包内。结果是：**无法在无真实 API/网络的情况下做确定性回归**；改 Context/Grounding/Plan 任一环节都需整段 handler 走查；Run 阶段不可观测，故障只能事后读日志。

在继续优化 Context/Grounding/Plan 之前，必须先获得**可测量、可注入、可回放**的执行内核与 Eval 基线——否则后续优化无法量化收益，也无法安全渐进迁移。

## 目标用户

- **开发/架构**：需要单测与 mock-replay 覆盖 Agent 循环，而不依赖用户 API Key 或飞书/MCP 连通性
- **制作人/QA**：需要可重复的 Agent 行为指标（阶段序列、工具次数、收敛原因）作为回归门禁
- **C 端用户（间接）**：内核重构对用户透明；本 Story 以行为保持为前提，避免「大爆炸重构」引入对话体验回退

## What Changes

- **新增 `AgentRunExecutor` 内核模块**（或等价命名）：从 `main.js` **渐进式**抽离 `ai-generate` 核心循环；通过依赖注入接收 LLM transport、tool executor、context builder、session store 等端口
- **显式 Run 状态机**：定义并贯穿执行路径的阶段枚举  
  `PREPARE → CONTEXT → MODEL → TOOL → RECOVER → VERIFY → FINALIZE → PERSIST → DONE | ERROR | CANCELLED`  
  阶段转换 MUST 可观测（trace/metrics），供 Eval 与调试使用
- **行为保持优先**：Phase 1 不改变渲染层 UI、不重写 `ContextCompiler`/`agent-context-orchestrator` 全部逻辑；`main.js` 保留薄 IPC 适配层
- **Mock-replay Agent Eval 基线**：建立 deterministic harness（fixture LLM 响应 + fixture 工具结果），覆盖 chat、知识工具、工具恢复、计划未完成、grounding、取消/错误等代表性场景
- **指标与回归门禁**：Eval 输出结构化报告（阶段序列、toolCalls、终态、plan 评估结果）；纳入 `npm test` 硬门禁；**CI MUST NOT 依赖真实 LLM API**
- **兼容与回滚**：环境变量或 feature flag（如 `KNOWME_AGENT_EXECUTOR=legacy|kernel`）允许回退至内联 handler；默认 Phase 1 完成后切 kernel，legacy 保留至少一个版本周期

## Capabilities

### New Capabilities

- `agent-run-executor`：可注入、显式状态机的 Agent Run 执行内核；负责阶段编排、预算、取消、trace/metrics emit，不包含 IPC/UI
- `agent-eval-harness`：基于 mock/replay 的 Agent Eval 框架、fixture 库、首批代表性用例与指标/report 输出约定

### Modified Capabilities

- `agent-thinking-timeline`：Run 阶段状态 MUST 映射为既有 stage/tool 事件（或等价 trace 字段），保证时间线行为不退化；新增 eval 可读的 `runPhase` 元数据（不改变 C 端文案要求）

## Non-goals

- 不一次性重写全部 Context/Grounding/Plan 编译链路
- 不做 Workbench daemon 统一、不做 Capability Hub UI 改版
- 不在本 Story 引入真实 LLM 在线 Eval 或 CI 硬依赖外部 API
- 不改动 Session Tab / Work Surface 交互模型
- 不合并 `extract-game-studio-capability-pack` 等并行 change 的范围

## 验收标准

- `AgentRunExecutor` 可在 Node 单测中独立运行，注入 mock LLM + mock tools，**零网络**完成至少 6 类代表性场景
- Eval harness 产出 JSON/Markdown report，包含：终态、阶段序列、toolCalls、plan 评估、错误/取消原因
- `main.js` 的 `ai-generate` 通过 adapter 委托 executor；`KNOWME_AGENT_EXECUTOR=legacy` 可回退
- 现有 `npm test` 全绿 + 新增 eval 用例全绿；`npm run lint` 无 error
- C 端冒烟：普通 chat、带工具检索、取消生成 —— 行为与升级前一致（无新增报错、时间线仍更新）
- OpenSpec validate 通过；tasks 全部勾选后可进入 `/opsx:apply`

## Impact

| 区域 | 变更 |
|---|---|
| `src/lib/agent-run-executor.js` | **新增**：状态机 + 循环编排 |
| `src/lib/agent-run-ports.js`（或内嵌 types） | **新增**：LLM/tool/context/session 端口契约 |
| `src/main.js` | **薄化**：`ai-generate` 委托 executor；保留 IPC/cancel/activeAgentRuns |
| `tests/agent-run-executor.test.js` | **新增**：单元测试 |
| `tests/agent-eval/` 或 `tests/fixtures/agent-eval/` | **新增**：fixture + replay 用例 |
| `scripts/agent-eval.js`（可选 npm script） | **新增**：Eval 报告 CLI |
| `package.json` | 可选 `test:agent-eval` 别名 |

依赖：无新增 npm 包。与 `agent-recovery`、`agent-verify`、`agent-tools`、`llm-usage` 模块协作，不替换其职责边界。
