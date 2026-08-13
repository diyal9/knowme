# Code Review: agent-kernel-executor-eval-baseline

> 正式复核 — 2026-08-04（Developer / gate-check 前）

## 审阅范围

| 区域 | 文件 |
|---|---|
| 执行内核 | `src/lib/agent-run-executor.js`, `src/lib/agent-run-ports.js` |
| 生产 adapter | `src/lib/agent-run-kernel-adapter.js` |
| IPC 适配 | `src/main.js`（`ai-generate` kernel 分支 L4124–4223、legacy 回滚 L4226+） |
| Eval | `tests/agent-eval-harness.js`, `tests/agent-eval-harness.test.js`, `tests/agent-run-executor.test.js`, `tests/fixtures/agent-eval/`, `scripts/agent-eval.js` |
| 时间线元数据 | emit 路径 `runPhase` 字段 |

**未纳入**：`extract-game-studio-capability-pack`、`restore-unified-knowme-brand-icon`、`unify-capability-fabric-foundation` 等并行 change 文件。

## 检查清单

| 项 | 结论 | 说明 |
|---|---|---|
| 行为保持 | ⚠️ ADVISORY | kernel 冒烟/Eval 与 legacy 终态一致；但 adapter 层存在 persist 双写与 tool 超时/取消未转发（见风险 R1/R2），与 legacy inline 非完全等价 |
| 端口边界 | ✅ | `agent-run-executor.js` 无 `fetch`/磁盘 IO；网络经 `ports.llm`，持久化经 `ports.session` |
| 状态机完整 | ✅ | PREPARE→…→PERSIST→DONE / ERROR / CANCELLED；7 fixture + 3 单测覆盖代表性路径 |
| Recovery/Verify | ✅ | 委托 `agent-recovery` / `agent-verify`，无重复实现；`plan-incomplete`、`tool-recovery` eval 绿 |
| 取消语义 | ⚠️ ADVISORY | MODEL 阶段 abort 正确（eval `cancel-mid-model` + 桌面 S3）；TOOL 阶段 adapter 未包装 abort race（R2） |
| Eval 确定性 | ✅ | mock replay 零网络；fixture 无真实 API Key；`npm test` 收录 |
| 回滚 | ✅ | `KNOWME_AGENT_EXECUTOR=legacy` 保留完整 inline 循环；默认 `kernel` |
| 性能 | ✅ | QA 报告 kernel/legacy 延迟比 1.23 < 2.0 |
| 并行 change | ✅ | 本 diff 未侵入 icon/pack/hub 范围 |
| IPC 契约 | ✅ | `runId`/`activeAgentRuns`/`ai-cancel-run` 不变；kernel 返回 shape 与 legacy 对齐 |
| 资源释放 | ✅ | kernel `finally` 中 `activeAgentRuns.delete` + `connectorRuntime.close()` |
| 敏感信息 | ✅ | fixture 仅 `mock-key`；错误文案不泄露 endpoint/key |

## 重点审查结论

### 状态机与终态

- `RunPhase` 枚举与 proposal/design 一致；`runPhases` 去重记录、`terminal` 与 `buildResult().report` 对齐。
- ERROR：`fail()` 进入 ERROR 并 emit error；CANCELLED：`checkAbort()` 在 PREPARE/CONTEXT/MODEL/TOOL 边界检查。
- 计划校验：`agentVerify.evaluatePlanCompletion` + `tryExpandBudget` + `finalizeResponse` 路径与 legacy 逻辑同构。

### 重复工具 / 恢复

- `agentLoop.toolCallKey` + `loopState.callCache` 去重；重复触发 `shouldFinalize` → VERIFY/FINALIZE。
- `agentRecovery.shouldAttemptRecovery` + `buildReflectionNote` 在 TOOL 全失败时进入 RECOVER。

### Legacy 回滚

- `resolveAgentExecutorMode()` 默认 `kernel`；`legacy` 分支完整保留（含 tool 超时 heartbeat、Promise.race abort）。
- 未删除 legacy 路径，符合 spec。

### 测试真实性

- Eval harness 直接调用 `AgentRunExecutor.run` + `createMockRunPorts`，非字符串断言；7/7 fixture 断言 terminal/phases/toolCalls。
- 生产 adapter 双写问题**未被** mock persist 覆盖（mock 不重复 push），属测试盲区（R1）。

## 风险与建议

### [ADVISORY] R1 — kernel adapter persist 双写 session.messages

- **位置**：`agent-run-executor.js` L521–531 push 后，`agent-run-kernel-adapter.js` L134–139 再次 `session.messages.push(...toolMessages, assistant)`。
- **影响**：kernel 路径可能写入重复 tool/assistant 消息；legacy 仅写一次（`main.js` L4833–4837）。
- **建议**：adapter `persist` 仅负责 compact/save/telemetry/plan.updated，不再 push messages（或 executor 不再 push，由 port 独占）。

### [ADVISORY] R2 — kernel adapter 未转发 tool timeout / abort / 等待心跳

- **位置**：executor 传入 `timeoutMs`/`signal`（L362–368），adapter `tools.execute` 仅调 `executeToolCall({ name, arguments })`（L105–108）；legacy inline 有 45s race + abort + 1s heartbeat（`main.js` L4539–4587）。
- **影响**：生成中点停（MODEL）已测；TOOL 执行中取消/超时行为可能与 legacy 分叉。
- **建议**：将 legacy `executeToolOnce` 包装迁入 adapter 或共享 helper。

### [ADVISORY] R3 — 双份 stage_prepare emit

- **位置**：`main.js` L3772/L4078 与 executor PREPARE/CONTEXT 均 emit `stage_prepare`。
- **影响**：时间线可能重复「正在准备/完成」步；QA 未报 BLOCKING。
- **建议**：Phase C 让 main 在 kernel 模式下跳过 pre-executor stage，或 executor 检测 `alreadyPrepared`。

### 非阻塞后续

- Phase C 将 context builder 完全移入 port，消除 main 预组装 + executor 二次 PREPARE。
- 增加 adapter 集成测：assert `session.messages` 长度与 legacy 一致。

## BLOCKING 条件核对

| 条件 | 结果 |
|---|---|
| executor 破坏 IPC 契约 | ❌ 未触发 |
| eval 依赖真实 API | ❌ 未触发 |
| 删除 legacy 且无回滚 | ❌ 未触发 |

**BLOCKING：无**

## 结论

- [x] **通过**（含 ADVISORY，不阻断 story-done）
- 审查人：Developer Agent（gate-check 复核）
- 日期：2026-08-04
