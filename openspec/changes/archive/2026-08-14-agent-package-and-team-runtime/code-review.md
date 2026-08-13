# Code Review: agent-package-and-team-runtime

- 日期：2026-08-07
- 审查人：开发（Developer · 收尾审查）
- 范围：Package/协议、RunStore、RunManager、Scheduler、Launcher、MessageBus、Orchestration、Output/UI、main/preload 集成与生产门禁证据

## 总结

| 维度 | 判定 | 说明 |
|---|---|---|
| 真实子 Run 启动 | **通过** | `main.js` 占位 `spawnSubRun` 已移除；`buildOrchestrationTools` 经 `RunManager.createAndLaunchChild` + `LocalExecutorAdapter` 启动隔离 `AgentRunExecutor` |
| 登记式假成功防护 | **通过** | `isFakeSpawnResult` / `normalizeSpawnResult` fail-closed；集成测 `fake_spawn_rejected` |
| 持久化 Run 树 | **通过** | `AgentRunStore` JSONL + 原子 `state.json`、checkpoint、receipt、recover replay |
| Message Bus | **通过** | v1 envelope、32KB 限制、去重、prompt injection 标记、RunStore 镜像 |
| Package / Team | **通过** | `agent-package-runtime.js` manifest 校验、DAG 无环、版本锁、跨 Builder adapter |
| 取消传播 ≤3s | **通过** | `cancelRun` 递归子树 + Launcher abort；88/88 Team Runtime 测 `cascadeUnderThreeSeconds` |
| 权限 / fail-closed | **通过** | per-Run allowlist、handoff schema、bus 未知版本、scope_denied、approval gate |
| Output / Workspace UI | **通过** | SUBRUN_* 事件、Run 树默认折叠、handoff/审批/Artifact/Evidence/预算；Electron smoke 13/13 |
| Daemon / 远程协议 | **通过** | `agent-service-protocol` + loopback HTTP E2E；handshake/cancel/resume 映射 |
| 硬门禁 | **通过** | npm test 1391/1391、lint PASS、Agent Eval 8/8、Team Runtime 88/88 |

## 实现对照（spec → 代码）

### agent-team-runtime

- **RunManager**（`src/lib/agent-run-manager.js`）：状态机、父子树、`createChildRun` / `cancelRun` / `retryRun` / `resumeRun`、terminal exactly-once、`adoptRunningRun` 供根 Run 接入 `ai-generate`。
- **Scheduler**（`src/lib/agent-run-scheduler.js`）：ready/waiting/blocked/retry 队列、parallel cap、join、retry backoff、wall budget。
- **Launcher**（`src/lib/agent-run-launcher.js`）：local / cursor / claude / daemon adapter registry；子 Run 独立 AbortSignal、handoff ≤32KB。
- **main 集成**（`src/main.js` L206–305, L4418+）：`ensureAgentTeamRuntime()` 懒初始化；`agentRuntimePortFactories` 为子 Run 构造隔离 ports；orchestration 工具面注入 `teamRuntime.manager`。

### agent-run-store / agent-message-bus / agent-package

- **RunStore**：`events.jsonl` append-only、hash chain、敏感字段 redact、`state.json` 原子写入（设计文档称 snapshot.json，语义等价）。
- **MessageBus**：类型白名单、seq 单调、terminal 后拒收非诊断消息、跨 run 授权校验。
- **Package runtime**：Team DAG、gate、cross-builder fixture（`tests/fixtures/agent-team-runtime/`）。

### agent-orchestration / output / workspace

- **Orchestration**：扩展 `delegate/spawn/await/status/cancel/message/handoff`；优先 RunManager，无 manager 时返回 `tool_unavailable`（非假成功）。
- **Output v2**：`mapBusMessageToOutputEvent`、SUBRUN_STARTED/PROGRESS/WAITING/COMPLETED/FAILED/CANCELLED。
- **Renderer**：`agent-message-state.js` Run 树分区；preload 暴露 `agentRunTree` / `agentRunResume` / `agentRunCancel` / `agentRunRetry`。

## 发现并修复的 BLOCKING

### B1：`ai-cancel-run` 可选链导致 TypeError（已修复）

**位置**：`src/main.js` `ipcMain.handle('ai-cancel-run')`

**问题**：`runtime?.manager.getRun(id).ok` 仅在 `runtime` 为 nullish 时短路到 `undefined`，随后对 `undefined` 调用 `.getRun()` 会抛 `TypeError`。场景：应用重启后、尚未触发 `ensureAgentTeamRuntime()` 时，UI 对陈旧 runId 发 cancel。

**修复**：

```javascript
if (!controller && !runtime?.manager?.getRun(id)?.ok) return { ok: false, code: 'run_not_found' }
```

**验证**：修复后无 active controller 且 runtime 未初始化时安全返回 `run_not_found`，不再 uncaught error。

## 风险扫描

| 风险 | 结论 |
|---|---|
| 登记式 spawn 回归 | **无**；生产路径无 `spawnSubRun` 占位；`isFakeSpawnResult` 单测覆盖 |
| 父取消资源泄漏 | **无**；eval + integration `runningLeakCount=0`、`withinBudgetMs` |
| 密钥入持久化日志 | **无**；`strictSecrets` + `redactSensitiveFields` + bus/store 扫描 |
| 子 Run 泄漏父会话 | **无**；子 ports 仅 system slice + handoff JSON，显式禁止父历史 |
| IPC structuredClone | **无**；bus/output payload 为 plain object |
| 双轨 activeSubRuns | **低**；main 仍保留 legacy sweep 作 best-effort，RunManager 为权威；不阻塞 |

## 遗留 ADVISORY（不阻塞）

1. **双轨 activeSubRuns**：main 仍保留 legacy sweep 作 best-effort，RunManager 为权威；不阻塞。
2. **`ai-cancel-run` 与持久化 Run**：cancel 在 runtime 未初始化时对已持久化 INTERRUPTED Run 返回 `run_not_found`；用户可通过新会话 `agent-run-resume` IPC（需同会话 port factory）或重新 prompt——符合 fail-closed，非缺陷。

## 收尾后已解决

- `KNOWME_AGENT_TEAM_RUNTIME=0` 已实现 fail-closed 紧急关闭：停用 Team orchestration tools，但不恢复登记式假成功。
- RunStore 文档与实现统一为原子 `state.json`。
- `tasks.md` 已全部勾选，制作人验收与正式 QA 均已通过。

## 审查结论

- **修复前**：1 项 BLOCKING（`ai-cancel-run` TypeError 边界）
- **修复后**：**无剩余 BLOCKING**
- **硬门禁全部通过**，制作人验收与正式 QA 已通过
