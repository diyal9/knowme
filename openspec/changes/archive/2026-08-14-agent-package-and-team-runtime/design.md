# Design: agent-package-and-team-runtime

## Context

### 现状调查（2026-08-07）

| 模块 | 已有能力 | 缺口 |
|---|---|---|
| `AgentRunExecutor` (`agent-run-executor.js`) | 显式阶段机、`ORCHESTRATE` 阶段标记、Grounding/Verify、v2 输出协议 emit、工具循环 | 不拥有 Run 树；子 Run 由外部 `spawnSubRun` 注入 |
| `agent-orchestration.js` | `delegate_to_expert` / `spawn_sub_run` / `handoff_artifact`、并行 cap、深度≤1、`cancelAllSubRuns` | 子 Run 状态仅存内存 `runStateStore`（TTL 1h）；`spawnSubRun` 未接真实 Launcher |
| `main.js` `spawnSubRun`（L4260） | 登记 `activeSubRuns` + AbortController | **占位假成功**：返回「已登记」文本，不启动 Executor |
| `main.js` `ai-cancel-run` | abort 父 Run + `cancelAllSubRuns` + sweep `activeSubRuns` | 子 Run 无真实进程/Executor 可取消；无持久化恢复 |
| `agent-run-kernel-adapter.js` | 生产 `RunPorts`、Grounding ledger、session checkpoint | 无 per-Run 权限快照、无 MessageBus、无 RunStore |
| `agent-output-protocol.js` v2 | lane/seq/terminal、legacy 映射 | 无子 Run 独立 stream 聚合规则；无 bus envelope |
| `agent-grounding-runtime.js` | ReferenceState、Evidence/Tool ledger、ClaimVerifier | 子 Run ledger 未汇总到父 Run；无跨 Run 证据链 |
| `expert-runtime` + `tool-contract-registry` | Expert 快照、orchestration policy、Registry 热路径 | Package 版本锁、Team DAG、per-Run 强制治理未统一 |
| `workbench-daemon-client.js` | `syncHandoffArtifacts` stub、agent catalog | 远程 Agent Service 握手、任务执行、恢复未标准化 |
| 数据 | `%APPDATA%\KnowMe\` sessions、drafts、audit jsonl | **无** `%APPDATA%\KnowMe\agent-runs/<runId>/` 事件日志与快照 |

动机与验收标准见 `proposal.md`。本设计 **不实现代码**，定义架构边界与迁移路径。

### 与主 Spec 的关系

| 主 Spec | 本 change 扩展点 |
|---|---|
| `agent-run-executor` | 保留为**单 Run 内核**；通过 Launcher 端口启动子实例；取消传播 ≤3s |
| `agent-orchestration` | 内存 registry → RunManager 持久化 Run 树 + Scheduler 队列 |
| `agent-output-protocol` | 父 Run stream 不变；子 Run 事件经 MessageBus 映射为 delegation/progress |
| `agent-grounding-runtime` | 每 Run 独立 ledger；父 Run VERIFY 可消费子 Run 汇总 evidence |
| `expert-runtime` | Package adapter 解析 orchestration policy、工具子集快照 |
| `tool-contract-registry` | per-Run 权限 envelope 强制于 Registry execute wrapper |
| `agent-thinking-timeline` | delegation 行、子 Run 摘要、审批/证据状态 |
| `workspace` | Run 树、handoff、恢复控制 UI（delta spec） |

---

## Goals / Non-Goals

**Goals**

- 建立 **Agent Package / Team Package** 声明式模型与校验，支持版本锁与跨 Builder 导入。
- 引入 **RunManager + Scheduler + Launcher + RunStore + MessageBus + Package adapters**，替换 `main.js` 占位 `spawnSubRun`，真实启动隔离子 Run。
- **保留 `AgentRunExecutor` 为单 Run 执行内核**；RunManager 只做编排、持久化、治理与 IPC 协调。
- append-only **JSONL 事件日志** + **原子 snapshot**；崩溃后可恢复、可审计、幂等。
- 统一本地 Executor、Cursor/Claude 兼容包、Workbench Daemon 的 **Agent Service Protocol**。
- fail-closed：未授权工具、未审批副作用、无证据外部事实、未知协议版本一律阻断。
- 父取消 → 3s 内子 Run 与后台进程归零；密钥与敏感参数不入持久化明文。

**Non-Goals**

- 开放式 Agent 市场、计费、第三方自动发布（见 proposal）。
- 替换 Grounding Runtime、Workbench Daemon 引擎或单 Agent Loop。
- 向子 Agent 默认复制父会话完整历史或暴露模型推理草稿。
- 引入 Electron 原生数据库；首期不允许任意系统命令/路径无审批访问。

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Renderer (workspace-agent.js, agent-message-state.js)                   │
│  - v2 protocol reducer  - Run tree / handoff / approval UI             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ preload IPC (structuredClone-safe)
┌───────────────────────────────▼─────────────────────────────────────────┐
│ Main Process — Coordination Layer (NEW)                                   │
│  RunManager ──► Scheduler ──► Launcher ──► AgentRunExecutor (per run)   │
│       │              │            │                                       │
│       ▼              ▼            ▼                                       │
│   RunStore      MessageBus    Package Adapters                            │
│  (JSONL+snap)   (envelope)   (local|cursor|claude|daemon)               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 agent-run-executor      tool-contract-registry    expert-runtime
 agent-grounding-runtime agent-output-protocol     workbench-daemon-client
```

**核心原则**：`AgentRunExecutor.run()` 仍是**唯一** LLM/工具/Grounding 循环实现；RunManager 不内联 model loop。

---

## Component Design

### 1. RunManager

**职责**：Run 树 CRUD、生命周期权威、取消/重试/恢复编排、与 Session 关联、IPC 查询 API。

**Run 记录（内存 + snapshot）最小字段**：

```js
{
  runId, parentRunId, rootRunId, depth,           // 树结构；depth≤1（可配置）
  status, phase, terminal,                        // running|waiting|done|error|cancelled
  packageRef: { kind, id, version, builder },    // agent-package | team-workflow
  expertSnapshotId,                               // 绑定 Expert 快照 hash
  permissions: { sandbox, connectors, budget, ... },
  childRunIds: [],                                 // 有序子 Run 列表
  joinStrategy: 'all'|'any'|null,                // 并行汇聚策略
  createdAt, updatedAt, startedAt, endedAt,
  cancelReason, stopReason,
  idempotencyKey,                                 // 客户端重试键
  seq: number,                                     // 最后持久化事件 seq
}
```

**API（主进程模块，非 IPC 名）**：

| 方法 | 行为 |
|---|---|
| `createRun(spec)` | 校验 Package → 分配 runId → 写 `run.created` 事件 → 可选入 Scheduler |
| `getRun(runId)` | 读 snapshot；过期/缺失返回 `not_found` 友好文案 |
| `getRunTree(rootRunId)` | 返回树形摘要（UI Run 树） |
| `cancelRun(runId, reason)` | 传播 cancel → Launcher → 子 Run + 进程 registry |
| `retryRun(runId, opts)` | 新 idempotencyKey 或显式 `force`；复用 Package 与 handoff |
| `resumeRun(runId)` | 从 snapshot + JSONL tail 重建 Scheduler/Launcher 状态 |
| `attachSession(runId, sessionId)` | 双向索引，不改变 Session 旧数据兼容 |

**与 `AgentRunExecutor` 关系**：

- RunManager **调用** `Launcher.launchLocalRun()`，内部构造 `RunPorts` 并 `AgentRunExecutor.run()`。
- RunManager **不**复制 executor 阶段逻辑；仅订阅 executor `emit` 转发到 RunStore + MessageBus + IPC。

**替换 `main.js` 占位**：

- 删除 inline `spawnSubRun` 假成功；改为 `RunManager.createChildRun(parentRunId, delegateSpec)`。
- `buildOrchestrationTools({ spawnSubRun })` 的 `spawnSubRun` 实现为 RunManager 委托：

```js
spawnSubRun: ({ subRunId, expertId, prompt, handoff }) =>
  runManager.createAndLaunchChild({
    runId: subRunId,           // orchestration 预分配 id 保留
    parentRunId: runId,
    expertId, prompt, handoff,
  })
```

---

### 2. Scheduler

**职责**：有限并行、等待汇聚、重试退避、队列 fairness；**不**执行工具或 LLM。

**队列模型**：

| 队列 | 说明 |
|---|---|
| `ready` | 依赖已满足、可 launch |
| `waiting` | 等待子 Run 终态或外部 Agent Service 回调 |
| `blocked` | 审批/门禁/预算；需用户或 policy 解除 |
| `retry` | 指数退避后重新入 `ready` |

**规则（默认，可被 Team Package 覆盖）**：

- 每父 Run **≤1** 并行子 Run（`parallel_cap`）；超出入 `ready` FIFO。
- 每 Run **≤2** 子 Run 总数（与 `agent-orchestration` 一致）。
- **Join**：父 Run 在 `ORCHESTRATE` 等待所有 `waiting` 子 Run 终态；`joinStrategy=all` 时任一 ERROR 上浮父 Run（可配置 `continueOnChildError`）。
- **Retry**：仅对 `retriable` 错误（network、timeout、`tool_unavailable`）；`scope_denied` / `orchestration_depth_exceeded` 不重试。
- Scheduler tick：主进程 `setImmediate` / 100ms coalesce；**不**阻塞 IPC。

**与 orchestration 模块**：

- `agent-orchestration.js` 的 `OrchestrationState` 变为 RunManager 的**内存视图**；权威状态在 RunStore。
- `canSpawn()` 改为查询 RunManager snapshot + Scheduler 队列深度。

---

### 3. Launcher

**职责**：按 Package adapter 选择执行后端，启动/取消/探测子 Run，向 RunManager 回报终态。

**后端类型（Package adapter 路由）**：

| Adapter | 启动方式 | 取消 |
|---|---|---|
| `local-executor` | 同进程 `AgentRunExecutor.run()` + 独立 `RunPorts`/`AbortController` | `abort()` + `cancelProcessesForRun` |
| `cursor-package` | Cursor 兼容包：stdio/HTTP Agent Service | service `cancelTask(taskId)` |
| `claude-package` | Claude Code / API 兼容层 | 同上 |
| `daemon-agent` | `workbench-daemon-client.createAndRun` / task slug | daemon `cancel` API |

**Launcher 契约**：

```js
{
  launch(runSpec, hooks: { emit, onTerminal, signal }) -> { handle, backend },
  cancel(handle, reason) -> Promise<{ withinBudgetMs }>,
  probeHealth(backend) -> { ok, code, message },
}
```

**关键约束**：

- **local-executor MUST 使用 `AgentRunExecutor`**，通过 `buildProductionRunPorts` 或子 Run 专用 adapter 构造 ports。
- 子 Run **独立** `runId`、`session slice`（仅 handoff 上下文，≤32KB JSON）、独立 tool surface（Expert 快照 ∩ Registry）。
- 子 Run **不**继承父 `apiMessages` 全量；handoff 经 MessageBus `handoff.request` / `handoff.result` 事件化。
- Launcher 注册表：`activeLaunches: Map<runId, { abort, backend, parentRunId }>`，供 `ai-cancel-run` sweep。

---

### 4. RunStore

**职责**：append-only 事件日志、原子 snapshot、checkpoint、留存与 compaction。

**目录布局**（`%APPDATA%\KnowMe\agent-runs\`）：

```
agent-runs/
  <runId>/
    events.jsonl          # append-only；一行一事件
    state.json            # 原子替换；最新物化视图
    state.json.tmp        # 写入中
    checkpoints/
      <seq>-<hash>.json   # 可选阶段性 checkpoint
    receipts/
      <idempotencyKey>.json  # 幂等收据
```

**events.jsonl 事件 envelope**：

```js
{
  v: 1,
  seq,                    // Run 内单调递增；与 output protocol seq 独立命名空间
  ts,
  type,                   // run.created | run.phase | run.child.spawned | ...
  runId,
  parentRunId,
  payload,                // 脱敏后 plain object
  prevHash,               // 可选 tamper-evident chain（与 audit 一致）
  recordHash,
}
```

**原子 snapshot 写入协议**：

1. 内存状态变更 batch 后，序列化到 `state.json.tmp`。
2. `fs.rename(tmp, state.json)`（Windows EPERM 退避 3 次，复用 draft CAS 模式）。
3. 最后 append `state.committed` 事件（含 stateHash）。

**恢复流程**：

1. 读 `state.json`；若损坏则扫描 `events.jsonl` 重放至最后 good seq。
2. 重建 RunManager 内存树 + Scheduler 队列（`status=running|waiting` 的 Run 标记 `recovering`）。
3. 对 `local-executor` 且 phase 可中断的 Run：**不**自动重跑 LLM；暴露 UI「继续 / 重试 / 放弃」。
4. 对 `daemon-agent` 进行中任务：Launcher `probe` + daemon task status 对齐。

**留存策略**：

| 数据 | TTL | Max | 行为 |
|---|---|---|---|
| terminal Run 目录 | 30d | 500 runs | LRU + 友好 `not_found` |
| events.jsonl | 随 Run 目录 | 单 Run ≤50MB | 超限 truncate 仅保留 snapshot + tail + `log.truncated` 事件 |
| receipts | 7d | 10k | 幂等查询 |

**敏感数据**：token、password、authorization、完整 tool args 含 secret → payload 存 `[REDACTED]` + `redactedFields[]`；原始仅内存。

---

### 5. MessageBus

**职责**：父子 Agent、Launcher 与 RunManager 之间的**版本化内部消息**；与面向 Renderer 的 `agent-output-protocol` v2 **分离**。

**Agent Message Envelope（bus v1）**：

```js
{
  busVersion: 1,
  messageId,              // uuid
  correlationId,          // 关联 handoff / 审批链
  runId, sourceRunId, targetRunId,
  kind,                   // task | handoff | approval | artifact | evidence | terminal | error
  schemaRef,              // package 内 schema id + version
  payload,                // ≤32KB；更大走 artifact ref
  ts,
  idempotencyKey,
}
```

**Kind 语义**：

| kind | 用途 |
|---|---|
| `task.assign` | Scheduler 分配子任务给 Launcher |
| `handoff.request` / `handoff.result` | 结构化上下文交接；对应 orchestration `handoff` |
| `approval.request` / `approval.decision` | 写操作 draft；与 tool-drafts-store 联动 |
| `artifact.publish` | 产物引用；可同步 daemon slug |
| `evidence.append` | 子 Run ledger 摘要汇入父 Run |
| `terminal` | 子 Run 终态；触发 Scheduler join |
| `error` | 结构化错误上浮；含 `code`/`retriable` |

**投递语义**：

- 同进程：**sync dispatch** + async microtask 订阅者；禁止跨 Run 直接函数调用绕过 bus。
- 持久化：所有 bus 消息 **MUST** mirror 到 RunStore（type=`bus.*`）供审计。
- 未知 `busVersion` → fail-closed，Run 转 `ERROR` + 用户可读「协议不兼容」。

---

### 6. Package Adapters

**职责**：解析 Agent Package / Team Package manifest，校验版本锁，投影工具/Expert/Workflow/DAG/门禁到 RunSpec。

**Package 类型**：

| kind | 内容 |
|---|---|
| `agent-package` | persona、capabilities、I/O schema、tools allowlist、orchestration policy、tests 引用 |
| `team-package` | workflow DAG、角色→agent 映射、join 节点、gates（eval/approval） |

**Adapter 接口**：

```js
{
  validate(manifest) -> { ok, errors[] },
  resolveVersion(manifest, lockfile) -> { ok, pinnedVersion },
  materializeRunSpec(ctx) -> { expertSnapshot, tools, permissions, workflow, gates },
  mapToBackend(manifest) -> 'local-executor' | 'cursor-package' | 'claude-package' | 'daemon-agent',
}
```

**与现有模块映射**：

- **Expert 快照**：复用 `expert-runtime` load + hash；Package 声明 `expertId` 或内嵌 EXPERT.md。
- **工具面**：`resolveToolSurfaceForRun({ runId, expertSnapshot, permissions })`；Registry 强制 per-Run allowlist。
- **Team DAG**：Scheduler 消费；节点类型 `agent|gate|join|human`；gate 失败 → `blocked` 队列。
- **版本锁**：Package `version` + `compat.builders[]`；不匹配 → 导入警告或 run 阻断。

**Builder 兼容**：

- `cursor-package` / `claude-package`：manifest 含 `builderProtocolVersion`；Launcher 转 Agent Service Protocol RPC。
- 本地 fallback：远程不可达且 Package 允许 `fallbackLocal` → `local-executor`。

---

## Electron 边界：Main / Renderer / IPC

### 分层

```
Renderer
  agent-message-state.js    — 仅消费 v2 output events
  workspace-agent.js        — Run 树、恢复按钮、handoff 卡
  ↕ preload (contextBridge)
Main
  RunManager / Scheduler / Launcher / RunStore / MessageBus
  AgentRunExecutor          — 单 Run 内核（无 Electron import）
  IPC handlers              — ai-generate, ai-cancel-run, agent-run-*
```

### IPC 契约（新增/扩展）

| Channel | 方向 | Payload 要点 | 约束 |
|---|---|---|---|
| `ai-generate` | R→M | 现有 payload + 可选 `packageRef`、`idempotencyKey` | 委托 RunManager.createRun → Launcher |
| `ai-cancel-run` | R→M | `runId` | RunManager.cancelRun；≤3s 子 Run 清零 |
| `ai-stream-event` | M→R | v2 envelope | structuredClone-safe；无 ports/函数 |
| `agent-run-tree` | R→M | `{ rootRunId }` | 返回树摘要（非全量 JSONL） |
| `agent-run-resume` | R→M | `{ runId, action }` | continue/retry/abandon |
| `agent-run-receipt` | R→M | `{ idempotencyKey }` | 幂等查询 |

**禁止**：

- Renderer spawn 子进程、读写 `agent-runs/`、直接调用 `AgentRunExecutor`。
- IPC payload 携带 `fakeApply`、test seam（生产 strip；见 harden-workbench 设计）。
- 子 Run 独立 IPC channel 向 UI 推流（避免 seq 混乱）；子 Run 事件经 **父 runId** 的 progress/tool lane 映射。

### Preload

- 暴露最小 API：`aiCancelRun`、`onAiStreamEvent`、`agentRunTree`、`agentRunResume`。
- 不暴露 RunStore 路径或 MessageBus 订阅。

---

## 生命周期

### Run 状态机（RunManager 层）

```
created → queued → running → waiting ──► running ──► terminalizing → done
                  │              │                              │
                  │              └── (join children)             ├── error
                  │                                              └── cancelled
                  └── blocked (approval/gate)
```

**与 AgentRunExecutor 阶段关系**：

| RunManager status | Executor phase（典型） |
|---|---|
| running | PREPARE…PERSIST |
| waiting | ORCHESTRATE（等子 Run） |
| blocked | TOOL pending_review 或 VERIFY fail-closed |
| terminalizing | FINALIZE/PERSIST/DONE |

### 子 Run 生命周期

1. 父工具 `delegate_to_expert` → orchestration 分配 `subRunId`。
2. RunManager `createChildRun` → RunStore `run.child.spawned` → Scheduler enqueue。
3. Launcher `launch` → 子 `AgentRunExecutor.run()` 或 remote service。
4. 子 terminal → MessageBus `terminal` → Scheduler join → 父 ORCHESTRATE 继续。
5. 父收到子 summary → 写入 tool result + optional `evidence.append`。

### 取消传播（≤3s 预算）

```
ai-cancel-run
  → RunManager.cancelRun(parent)
    → Launcher.cancel(all active children)  // abort + daemon cancel
    → agentOrchestration.cancelAllSubRuns({ cancelSubRun })
    → agentProcessTools.cancelProcessesForRun
    → RunStore append run.cancelled
    → emit v2 run.cancelled
```

**验证**：`withinBudgetMs ≤ 3000`；`runningLeakCount === 0`（与现有 eval 一致）。

---

## 恢复与幂等

### 幂等键

- 客户端在 `ai-generate` 传 `idempotencyKey`（UUID）；RunStore `receipts/` 记录 `{ key → runId, status }`。
- 重复请求且原 Run `running|done` → 返回原 `runId`，**不**二次 launch。
- 重复请求且原 Run `error|cancelled` → 需显式 `retryRun` 或新 key。

### 崩溃恢复

| 场景 | 行为 |
|---|---|
| 主进程崩溃 mid-run | 重启读 snapshot；running 标记 `recovering`；UI 提示恢复 |
| snapshot 损坏 | 重放 JSONL；最后 good snapshotHash 校验 |
| 子 Run done 父 waiting | Scheduler 重入 join；补发 `handoff.result` 若缺失 |
| daemon 任务 orphan | Launcher probe；对齐 terminal 或 cancel |

### 事件幂等

- RunStore append：`seq` 严格递增；重复 seq 拒绝写入。
- Renderer：`agent-message-state` 忽略 `seq` 重复/倒退（已有 spec）。
- MessageBus：`messageId` + `idempotencyKey` 去重。

---

## 安全与权限

### per-Run 权限 envelope

每个 Run（含子 Run）创建时 materialize：

```js
{
  sandbox: { enabled, workdir, allowNetwork, ... },
  connectors: { allowedConnectorIds[] },
  tools: { allowlist[], denylist[] },
  orchestration: { allowDelegate, maxParallel, allowedSubExperts[] },
  budget: { maxToolCalls, maxLlmRounds, maxWallMs, maxCostUsd? },
  approvals: { sideEffectDefault: 'draft' },
  paths: { contentRoots[], denyTraversal: true },
}
```

**强制点**：

- `resolveToolSurfaceForRun`：投影前 filter allowlist。
- Registry execute wrapper：校验 contract + permissions；失败 `scope_denied`。
- Launcher：remote adapter 不得扩大 permissions；仅 shrink。
- RunStore：permissions 快照 immutable；变更需新 Run。

### fail-closed 清单

| 条件 | 结果 |
|---|---|
| 未授权工具 | `scope_denied`；不调用 handler |
| 未审批写副作用 | `pending_review`；不算 evidence ok |
| 无 grounding 证据的外部事实 | OutputGate blocked |
| 未知 output/bus 协议版本 | ERROR + 可读提示 |
| Package 签名/版本不匹配 | 创建 Run 拒绝 |

### 审计

- 工具 side-effect：`auditId` 关联 RunStore event。
- hash chain（可选 tamper-evident）：与 `tool-contract-registry` audit 对齐。
- 密钥永不入 JSONL/snapshot 明文。

---

## Grounding 集成

### 每 Run 独立 ledger

- 子 Run：`buildProductionRunPorts` 创建独立 `EvidenceLedger` / `ToolLedger` / `ReferenceState`（handoff 初始化 reference，不复制父 pendingSelection 除非 handoff 显式携带）。
- 父 Run：`ORCHESTRATE` 完成时 MessageBus `evidence.append` 携带子 Run ledger **摘要**（digest + provenance refs，非全量 raw）。

### 父 Run VERIFY

- 父 Run FINALIZE 前 ClaimVerifier 可声明 `acceptChildEvidenceIds[]`。
- 子 Run truncated/empty evidence **不得**作为父 Run 外部事实依据（fail-closed）。
- 子 Run blocked → 父 delegation 步骤显示 blocked；父模型收到 honest summary，非假成功。

### Grounding 与 Package gates

- Team Package 可声明 `requiredTools` / `requiredEvidence` gate；Scheduler `blocked` 直至满足。
- eval harness 硬门禁：跨 Builder 场景必测 grounding（proposal 验收）。

---

## Daemon 兼容

### 不替换 Daemon

- Workbench Daemon 仍为外部 workflow 引擎；本 change 标准化 **handoff 与 Agent roster** 接入。
- `workbench-daemon-client.syncHandoffArtifacts` 从 stub 升级为真实 API（若 daemon 可用）；失败降级为本地 artifact ref + audit warning。

### Agent Service 对齐

| 能力 | 本地 | Daemon |
|---|---|---|
| Agent catalog | expert-runtime + Package | `overview.agents` |
| 执行任务 | AgentRunExecutor | `createAndRun` / task slug |
| 取消 | abort | daemon cancel |
| Artifact | agent-artifact-tools | `artifacts` API |
| Handoff | MessageBus | `syncHandoffArtifacts` |

### 模式共存

- Session `run.mode` 可为 `local|daemon|hybrid`；RunManager 统一树视图。
- Daemon offline：Package `fallbackLocal` 或 UI 诚实 blocked（不 silent fail）。

---

## 输出协议映射

### 原则

- **每个 Run 一个 v2 stream**（独立 `runId` + `seq`）；Renderer 主对话绑定 **root/parent runId**。
- 子 Run **不**直接向 Renderer 推 answer lane；仅经映射进入父 progress/tool lane。

### 映射表（bus/executor → v2）

| 源 | v2 type | lane | 说明 |
|---|---|---|---|
| 子 Run stage/tool | `tool.*` / `stage` | progress/tool | payload 含 `subRunId`, `expertId`, `delegation: true` |
| 子 Run terminal | `tool.completed` 或 `tool.failed` | tool | summary 为子 Run 首行 + status |
| 父 ORCHESTRATE | `stage` | progress | `runPhase: ORCHESTRATE` |
| handoff | `stage` 或 custom `handoff.ready` | progress | ≤32KB 摘要 |
| approval | `tool.*` | tool | `requiresApproval`, `draftId` |
| grounding | `grounding-status` | progress | 父子各自 emit；父可合并展示 |
| 终态 | `run.completed/cancelled/failed` | terminal | **每 Run 恰好一个** |

### Legacy 兼容

- 迁移期保留 `mapLegacyEvent`；Team Run 默认 v2。
- 历史 Session 无 Run 树：UI 隐藏 Run 树面板，聊天不变。

### Timeline（agent-thinking-timeline）

- delegation 行：`toolTimelineTitle` → 「委派 · {expertName} · {status}」。
- 可展开子 Run 摘要链接（非嵌套全工具细节，符合 spec）。

---

## 迁移与回滚

### Phase 划分

| Phase | 内容 | 门禁 |
|---|---|---|
| P0 | 本 design + delta specs + tasks | planning |
| P1 | RunStore + RunManager 骨架；单 Run 持久化；无子 Run | unit tests |
| P2 | Launcher local-executor；替换 `spawnSubRun` 占位 | 父子 Executor 集成测试 |
| P3 | Scheduler + MessageBus + orchestration 持久化 | cancel ≤3s leak=0 |
| P4 | Package adapters + Team DAG + gates | 跨 Builder eval |
| P5 | Daemon/remote adapters + workspace Run 树 UI | E2E evidence |

### Feature flags

| Flag | 行为 |
|---|---|
| `KNOWME_AGENT_TEAM_RUNTIME=0` | 关闭 Team orchestration tools，保留单 Agent 与根 Run 审计；委派 fail-closed，不恢复占位假成功 |
| `KNOWME_AGENT_TEAM_RUNTIME=1` | RunManager 路径（默认 tasks 完成后） |
| `KNOWME_AGENT_RUN_PERSIST=0` | 内存 orchestration only（P1 前） |
| `KNOWME_AGENT_EXECUTOR=legacy` | 仍可用；与本 change 正交 |

### 数据迁移

- 旧 Session：无 `agent-runs/` 目录；**不**强制回填。
- 新 Run：创建时写 RunStore；Session 增加 optional `run.rootRunId` 指针。
- 回滚：flag=0 停止创建子 Run；已写目录保留且根 Run 继续审计，不删除用户数据。

### 回滚策略

- 不涉及 schema 破坏 state v1；降级读 state 忽略未知字段。
- Package 导入失败不阻塞单 Agent chat tier。

---

## 性能与内存

### 预算

| 项 | 目标 |
|---|---|
| RunStore append | ≤5ms p95（SSD）；异步 batch fsync 每 100ms 或 10 events |
| snapshot 写入 | ≤20ms；Run 终端 + checkpoint 触发 |
| Run 树查询 | ≤50ms（500 nodes 内）；内存 cache + snapshot |
| MessageBus dispatch | 同进程 sync <1ms |
| 并行子 Run | 默认 1；避免双 LLM 流内存尖峰 |

### 内存

| 结构 | 上限 |
|---|---|
| RunManager 热 cache | 100 active + 100 terminal 摘要 |
| JSONL tail buffer | 256KB 读缓冲 |
| orchestration runStateStore | 与现有一致；持久化后可 shrink TTL |
| 子 Run session slice | handoff ≤32KB；messages 独立 capped |

### compaction

- terminal Run：7d 后 events.jsonl 可 compact 为 `events.summary.jsonl` + 删中间 checkpoint。
- 单 Run 50MB cap：truncate + audit `log.truncated`。

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| RunManager 与 Executor 职责渗透 | 双循环、难测 | **硬规则**：Executor 唯一 model loop；code review touch list |
| JSONL 写放大 | 磁盘 IO | batch append；snapshot 节流 |
| Windows rename EPERM | snapshot 损坏 | tmp + 3 次退避；JSONL 重放 |
| 远程 Agent 取消慢 | 超 3s 预算 | best-effort + leak detector + UI「强制停止」 |
| 跨 Builder 协议漂移 | 运行失败 | Package version lock + fail-closed |
| Run 树 UI 复杂度 | 体验噪音 | 默认折叠 delegation；详情按需展开 |
| 与活跃 change 冲突 | 合并 pain | 路径隔离：`src/lib/agent-team-*` 新模块；main.js 薄委托 |
| 内存 Run 树 + 持久化双写 | 不一致 | RunStore 为权威；内存仅 cache |

---

## 测试与证据（设计约束）

- **单元**：RunStore 重放、幂等 receipt、Scheduler join、MessageBus 去重。
- **集成**：mock LLM 触发 delegate → 真实子 `AgentRunExecutor` → 父汇总。
- **安全**：scope_denied、approval gate、grounding blocked 子 Run 上浮。
- **E2E**：Electron smoke 替换占位 spawn；cancel leak=0；恢复 resume。
- **eval**：`agent-eval-harness` 增加 cross-builder、recovery、approval 硬门禁。

证据路径：`openspec/changes/agent-package-and-team-runtime/evidence/`（tasks 阶段产出）。

---

## Resolved Decisions

1. Team Package DAG 复用现有 Workbench workflow JSON 的 `agent|gate|terminal` 节点语义，并增加 `join|human`；不引入 YAML 解析依赖。
2. Remote adapter 使用独立 `serviceTimeoutMs` 与受限重试策略，不复用工具调用 timeout；Runtime 仍以 Run 剩余 wall-clock 预算作为上限。
3. Run 树放入现有 Agent 时间线/轨迹区域，默认折叠；Artifact 与复杂审批继续在 Work Surface 展开，不新增一级 tab。

---

## 决策摘要

| ID | 决策 | 理由 |
|---|---|---|
| D1 | **保留 AgentRunExecutor 为单 Run 内核** | 已有 eval、Grounding、output protocol；避免重写 |
| D2 | RunManager 协调，不内联 loop | 关注点分离；子 Run = 新 Executor 实例 |
| D3 | 替换 main.js `spawnSubRun` 占位 | proposal 核心验收；真实隔离执行 |
| D4 | JSONL + 原子 snapshot，无 DB | 与现有 audit/draft 一致；可重放 |
| D5 | MessageBus 与 v2 output 分离 | 内部审计 vs C 端契约解耦 |
| D6 | Package adapters 统一 Builder | 跨 Cursor/Claude/Daemon 治理入口 |
| D7 | fail-closed 默认 | 企业合规与 grounding 一致 |
| D8 | 子 Run 不推独立 answer stream | 单 seq 空间；timeline 可理解 |
| D9 | feature flag 回滚 | 与 KNOWME_TOOL_SURFACE / AGENT_EXECUTOR 策略一致 |
| D10 | Team DAG 复用 Workbench JSON 子集 | 降低迁移与校验成本 |
| D11 | Remote service 独立 timeout/retry | 避免把远程生命周期误当工具调用 |
| D12 | Run 树内嵌现有 Agent 时间线 | 保持信息架构稳定且避免新增一级导航 |
