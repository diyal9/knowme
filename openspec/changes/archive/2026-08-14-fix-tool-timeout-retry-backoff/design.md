## Context

See proposal.md — Why。当前 `main.js` / `agent-run-executor.js` 对工具有 `TOOL_EXEC_TIMEOUT_MS=45s` 的 `Promise.race`，超时后 `agent-recovery.planRetry` 会重试（已有短指数退避 400→800→1600ms），但：

1. race 胜出后底层 `run_task` 子进程未必被杀（handler 忽略 abort signal；外层也不调 `cancelProcessesForRun`）
2. UI 心跳仍刷 `tool.started` + pending，体感像死等
3. 超时类退避过短，重试几乎贴着连续打满 3×45s

## Goals / Non-Goals

**Goals**

- 超时立即收口步骤 + 杀本 Run 进程工具
- 超时/网络重试使用更清晰的指数退避，进度可见
- `run_task` 等 handler 响应 abort

**Non-Goals**

- 不改 Daemon 管线任务状态机
- 不改工具合约字段 schema（仍用既有 `timeoutMs`）

## Decisions

1. **超时杀进程**：外层 `tool_timeout` 结算时调用 `cancelProcessesForRun(runId)`；`runTaskOnce` 监听 `signal` abort 并 `defaultKill`。
2. **退避参数**：`planRetry` 对 `timeout` 使用更大 base/cap（如 base 2000、cap 30000）；`network` 保持现有短退避。仍无抖动，保证测试确定性。
3. **可见性**：退避等待前 emit `tool.started`（或等价）summary 含「超时，Xs 后第 N 次重试」；最终失败 emit `tool.failed`。
4. **双路径**：`main.js` legacy 循环与 `agent-run-executor` 同步改，避免 flag 切换行为分叉。

## Risks / Trade-offs

- [误杀并发进程] → 仅按 `runId` 取消 registry 内 running 条目
- [超时后晚到的成功结果] → race 已 settled 忽略后续 resolve；杀进程后 close 走 cancelled/timeout
- [总时长仍可能约 2min+] → 可接受；UI 明示重试，避免误以为卡死

## Migration Plan

纯行为修复，无需数据迁移。回滚：还原上述模块即可。

## Open Questions

无。
