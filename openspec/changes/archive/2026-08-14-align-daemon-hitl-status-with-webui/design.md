## Context

See proposal.md — Why. KnowMe 将 Daemon `GET /api/tasks/{slug}` 的 `job` / `status` / `pending_*` 投影到顶栏与进度卡；当前 `taskState()` 优先 `job.state`，且 Outcome / brief 在 completed 时吞掉 HITL。

## Goals / Non-Goals

**Goals:**

- 单一运行态解析：HITL 待办优先；`status.state` 优先于 `job.state`。
- 渲染层（pill / brief / progress / surface bucket）共用同一优先级。
- 与 WebUI 标签对齐：待澄清 → 待处理/等待你；非终态 idle+HITL 不得 done。

**Non-Goals:**

- 不改 IPC 通道形状（仍返回 task + projection）。
- 不引入新 UI 组件，只修正状态与进度文案。

## Decisions

1. **共享 `hasPendingHitl` / `resolveDaemonRuntimeState`（lifecycle 或 client 纯函数）**  
   - HITL：`pending_clarifications` / `pending_gates` / `waiting` / `gate` / `clarification`。  
   - 有 HITL 且非 failure/cancelled → 显示态 `waiting`，`terminal=false`。  
   - 无 HITL → `status.state || state || job.state || idle`。  
   - Alternatives：仅改 UI 文案 → 拒绝（进度/HITL 仍错）。

2. **`runOutcomePresentation`：等待分支先于完成**  
   - 与 design of `clarify-workflow-run-status-surface` 的 L1 语义一致，修正实现顺序。

3. **`buildWorkbenchTaskBrief`：有 gate/clarification 时不得 `succeeded`**  
   - 即使 `terminalKind=success` 或 status=done，仍 `waitingKind=clarification|gate`。

4. **`projectChatProgressCard`：waitingKind ≠ none 时禁止 terminalDone 强制 100%**  
   - 步数按真实 step status / current_step 推断。

5. **client `task()` 返回体：computed `state`/`terminal` 覆盖 body 同名字段**  
   - 修复 `...body` 覆盖 computed 的顺序 bug。

## Risks / Trade-offs

- [Risk] 个别任务 job 已 completed 且无 pending_* 但磁盘仍有澄清文件 → Mitigation：仍以 API pending_* 为准（与 WebUI 一致）。
- [Risk] 列表卡片与详情态短暂不一致 → Mitigation：列表同样走 `resolveDaemonRuntimeState` / surface bucket。

## Migration Plan

无数据迁移；热重载即可验证。
