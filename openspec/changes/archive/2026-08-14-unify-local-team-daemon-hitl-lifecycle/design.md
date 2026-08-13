## 设计

### 统一投影层

在现有 `workbench-task-lifecycle.js`（Daemon HITL 优先、`resolveDaemonRuntimeState`）上扩展 `projectRunLifecycle(input)`：

| 字段 | 含义 |
|------|------|
| `kind` | `waiting` \| `active` \| `success` \| `failure` \| `cancelled` |
| `hitlKind` | `none` \| `gate` \| `clarification` |
| `outcomeLabel` | 顶栏 L1：等待你 / 执行中 / 已完成 / 失败 / 已取消 |
| `compactLabel` | 列表/节点：待处理 / 待确认 / 澄清 / 进行中 / 完成 / … |
| `cancellable` | 非终态且处于 active 或 waiting 时为 true |

Daemon 任务传入 `task` 对象时走 `resolveDaemonRuntimeState`；local/agent-graph 走 `classifyTaskState` + pending gate 投影。

### Cancel 路径

```
UI「停止」→ window.api.workbenchDaemonCancel(slug)
  → IPC workbench-daemon-cancel
  → client.cancel(slug) → POST /api/tasks/{slug}/cancel
  → refreshDaemonTask → 统一 lifecycle 标 cancelled
```

与 local：`agentRunCancel` → `AgentRunManager.cancelRun` 对称；均使用 reason `user_cancelled`。

### 展示接入点

- `runOutcomePresentation()`：优先读 `projectRunLifecycle` 的 `outcomeLabel`/`tone`
- `daemonRunStatusLabel()`：委托 `compactLabel`
- `agentGraphStatusLabel()`：委托 `compactLabel`（保留 pending→准备中 语义）
- `renderDaemonRunner()`：cancellable 时显示「停止」

### 风险

- Cancel API body 未在 upstream 文档细化：客户端发送可选 `{ reason }`，空 body 亦兼容。
- 取消后 SSE 需 `stopDaemonRuntimeWatchers`（已有 refresh 路径复用）。
