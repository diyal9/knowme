## Context

See proposal.md — Why。`src/ipc/ai-generate.js` 在 `buildDynamicContext` 中调用 `buildTemporalAnchorContext()`，但该函数仅定义于 `main.js` 局部作用域，IPC 模块无法访问。

## Goals / Non-Goals

**Goals:**

- 让 `ai-generate` 能稳定注入时间锚点。
- 函数可单测，避免再依赖 main 闭包。

**Non-Goals:**

- 不把其它 main 内助手函数一并外提。
- 不通过 `deps` 注入该纯函数（无状态、无 Electron 依赖）。

## Decisions

1. **落点 `src/lib/temporal-anchor.js`**  
   纯工具、无 IO；比塞进 `agent-context-orchestrator` 或经 deps 传递更清晰。  
   备选：留在 `ai-generate.js` 顶层 — 可测性差、其它模块难复用。

2. **main.js 删除死函数**  
   拆分后 main 已无引用，保留只会误导后续维护。

3. **横向泄漏：deps 注入 vs 本地 require**  
   - 依赖 main 共享状态的（如 `agentRuntimeOutputBridges` Map、`mergeExtraTools`）走 deps。  
   - 已是独立 `lib/` 模块的（`agent-process-tools` / `agent-orchestration`）在 ipc 内直接 require，避免假 deps。

4. **防回归守卫测试**  
   `tests/ipc-free-helper-guard.test.js` 盯住已知 watchlist，避免同类 ReferenceError 再漏测。

## Risks / Trade-offs

- [Risk] 其它未发现的裸调用仍依赖 main 闭包 → Mitigation：守卫测试覆盖关键路径；后续 IPC 拆分应自带 require/deps 审查。
- [Risk] `mergeExtraTools` 等仍住在 main → Mitigation：本 Story 以止血为主；后续可再抽 lib。
