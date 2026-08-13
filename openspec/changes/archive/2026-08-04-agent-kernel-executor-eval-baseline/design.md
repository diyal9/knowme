# Design: agent-kernel-executor-eval-baseline

## Context

现状（`src/main.js` `ai-generate`，约 L3719+）：

| 事实 | 位置/含义 |
|---|---|
| 单 handler 内联 prepare → context → model loop → tool → recovery → verify → finalize → persist | 不可单测完整循环 |
| `activeAgentRuns` + `AbortController` 管理取消 | 与循环逻辑同文件 |
| `stage()` / `emit()` 推送 `ai-stream-event` | 渲染进程时间线依赖 |
| `agent-recovery`、`agent-verify`、`llm-usage` 已模块化 | 循环仍 orchestrate 于 main |
| `agent-streaming-integration.test.js` 以**源码字符串断言**验证 wiring |  fragile，非行为 replay |

本设计在**不改变 C 端可见行为**前提下，抽出 executor 并建立 eval 基线。动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 定义可注入端口的 `AgentRunExecutor`，显式状态机贯穿 Run
- Phase 1 从 main 迁移**编排逻辑**；context 组装仍调用现有 `agent-context-orchestrator` / main 内联 builder（通过 port 注入）
- Mock-replay eval：fixture 驱动 LLM 多轮 tool_calls 与工具结果，确定性断言终态与指标
- Feature flag 回滚；eval 纳入 `npm test`

**Non-Goals:**

- 重写 ContextCompiler 或统一 Workbench daemon
- 渲染进程/UI 变更
- 真实 API eval、embedding 在线 rerank eval
- 在本 Story 删除 legacy inline 实现（保留至稳定后）

## Decisions

### D1. 模块边界：`AgentRunExecutor` 在主进程纯 Node 模块

**决策**：新增 `src/lib/agent-run-executor.js`，不含 Electron IPC。IPC handler 构造 `RunPorts` 并调用 `executor.run(input, ports, emit)`。

**理由**：Eval 与单测必须在 Node 环境零 Electron 启动运行。**Alternative**：保留循环于 main — 拒绝，无法 mock-replay。

### D2. 显式状态机与既有 stage id 映射

**决策**：内部枚举 `RunPhase`：

```
PREPARE → CONTEXT → MODEL ⇄ TOOL → RECOVER → VERIFY → FINALIZE → PERSIST → DONE
                                                                              ↘ ERROR
任意阶段 ─────────────────────────────────────────────────────────────────→ CANCELLED
```

- `MODEL`：单次 LLM 请求（含 streaming chunk 转发）
- `TOOL`：执行 tool_calls（可多次进入，每次后回 `MODEL`）
- `RECOVER`：消费 `agent-recovery` 策略（重试/反思提示）
- `VERIFY`：`agentVerify.evaluatePlanCompletion`
- 每个 phase 进入/退出写入 `trace` 与 `metrics.runPhases[]`

**与 UI 映射**（保持行为）：

| RunPhase | 既有 stage id（示例） |
|---|---|
| PREPARE | `stage_prepare` |
| CONTEXT | `stage_retrieval` / context 子阶段 |
| MODEL | `stage_generate` / streaming |
| TOOL | `tool.*` events |
| VERIFY | plan verify 阶段（若无则 no-op emit） |
| FINALIZE | `正在整理最终答复` |
| PERSIST | session/usage 写盘 |

**理由**：Eval 读 `runPhases`；UI 仍读既有 event shape，避免 UI Story。

### D3. 端口注入（Ports / Adapters）

**决策**：`RunPorts` 接口（Plain object + 函数）：

```js
{
  llm: { complete(messages, opts) -> { text, toolCalls, usage, stream? } },
  tools: { execute(toolCall, ctx) -> result, surface: { definitions } },
  context: { build(input) -> { messages, tier, wikiCtx, ... } },
  session: { load, save, recordTool, ... },
  settings: { load() -> api config },
  clock: { now() },
  signal: AbortSignal,
}
```

- **Production adapter**：main 内 factory，绑定真实 fetch、agent-tools、现有 context 路径
- **Eval adapter**：replay fixture 按 call index 返回 canned 响应

**理由**：最小接口满足 6 类 eval；避免 over-abstract ContextCompiler。

### D4. 渐进迁移三阶段（本 Story = Phase A+B）

| 阶段 | 内容 | 回滚 |
|---|---|---|
| **A** | 抽出 executor + ports；main 双路径（flag） | `KNOWME_AGENT_EXECUTOR=legacy` |
| **B** | Eval harness + 6+ fixtures；默认 kernel | legacy 保留 |
| **C**（后续 Story） | 进一步下沉 context builder 到独立模块 | 不在本 Story |

**决策**：Phase A 结束时 kernel 路径与 legacy **行为等价**（同一输入 → 相同终态/trace 语义，允许 timing 差）。

### D5. Mock-replay Eval 格式

**决策**：Fixture 文件 JSON：

```json
{
  "name": "chat-simple",
  "input": { "prompt": "你好", "tier": "chat" },
  "llmScript": [
    { "response": { "text": "你好！" } }
  ],
  "expect": {
    "terminal": "DONE",
    "phases": ["PREPARE","CONTEXT","MODEL","PERSIST","DONE"],
    "toolCalls": 0
  }
}
```

- `llmScript[i]` 可含 `toolCalls`；对应 `toolScript[i]` 返回工具结果
- Harness 运行 `AgentRunExecutor` + mock ports，对比 `expect`
- 报告写 `stdout` 或 `openspec/changes/.../evidence/eval-report.json`（开发自测）

**理由**：Deterministic、可 diff、无 API Key。

### D6. 指标与 CI 门禁

**决策**：

- 硬门禁：`tests/agent-eval/*.test.js` 随 `npm test` 运行
- 指标字段：`terminal`, `runPhases`, `rounds`, `toolCalls`, `planEval.action`, `cancelled`, `error.code`
- **CI MUST NOT** 调用真实 LLM；现有 integration 字符串测试保留，新增 eval 逐步替代 fragile 断言

### D7. 取消与错误传播

**决策**：`signal.aborted` 在 phase 边界检测 → `CANCELLED`；未捕获异常 → `ERROR` 并 emit 既有 error event。`activeAgentRuns` 仍由 main 注册，executor 接收 `signal`。

## Architecture

```
Renderer                    Main (IPC thin)                 Kernel (testable)
─────────                   ───────────────                 ─────────────────
workspace-agent.js
  aiGenerate() ──IPC──► ai-generate handler
                          ├ buildRunPorts(real deps)
                          ├ activeAgentRuns.set(runId, controller)
                          └ AgentRunExecutor.run(input, ports, emit)
                                ├ PREPARE: settings validate
                                ├ CONTEXT: ports.context.build()
                                ├ MODEL: ports.llm.complete()
                                ├ TOOL: ports.tools.execute()
                                ├ RECOVER: agent-recovery
                                ├ VERIFY: agent-verify
                                ├ FINALIZE / PERSIST
                                └ emit → ai-stream-event

tests/agent-eval/*.test.js
  mock ports + fixture ──► AgentRunExecutor.run() ──► assert expect
```

进程边界：executor、recovery、verify 均在**主进程**；渲染进程仅消费 stream events（不变）。

## Performance & Memory

- 启动：executor 模块 lazy require，无顶层副作用
- 内存：fixture 体积有上限（单 fixture < 500KB）；replay 不启动 Electron
- 运行时：双路径 flag 仅增加一次 branch，可忽略

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 双路径 drift（legacy vs kernel） | Eval 覆盖代表性场景；Phase B 后默认 kernel；短期保留 legacy |
| 抽离遗漏 edge case 导致行为变化 | 行为保持为首要目标；制作人冒烟 + 既有 test 全绿 |
| Fixture 维护成本 | 首批 6 个最小集；命名与 spec scenario 对齐 |
| Context 仍部分内联于 main adapter | Phase C 再下沉；本 Story 通过 port 封装即可 |

## Migration Plan

1. 落地 executor + ports + 单测（flag 默认 `legacy`）
2. 接入 main adapter；本地对比 legacy/kernel 冒烟
3. 添加 eval fixtures；`npm test` 绿
4. 默认 `kernel`；document `KNOWME_AGENT_EXECUTOR=legacy` 回滚
5. Story 完成后 **不** 立即删除 legacy 代码块（注释标记 `@deprecated legacy-ai-generate-loop`）

**Rollback**：设置 `KNOWME_AGENT_EXECUTOR=legacy` 或 revert commit；无数据迁移。

## Open Questions

- Eval report 是否上传 CI artifact：本 Story 仅本地/stdout；后续 CI 可接
- Phase C context builder 模块名：待 executor 稳定后再定
