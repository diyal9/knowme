## Context

见 `proposal.md` Why。主进程三轮 change 结构已绿，Story 硬门禁仍被既有测试红挡住。失败簇上次快照：Node ~49 fail（executor 协议 / eval / team-runtime / audit 路径等）、Vitest ~5 fail（capability-hub / manage / run / studio overlay）。

## Goals / Non-Goals

**Goals:**
- 让 `npm test` 与 `npm run test:renderer` 对 harness gate 为 PASS。
- 失败按簇修：协议常量对齐、审计落盘、渲染规格与产品行为一致。

**Non-Goals:**
- 不改 `src/main` 组合根形状。
- 默认不缩小硬门禁范围；若必须拆套件，须单独经制作人确认并改 harness 文档。

## Decisions

1. **优先修产品/契约，再改断言**：例如 `SUPPORTED_PROTOCOL_VERSION` 与测试期望不一致时，先核对 `agent-output-protocol` / bus 真值，再改测试或实现。
2. **按簇推进**：executor → team-runtime/eval → audit 落盘 → Vitest overlay，避免一次大扫。
3. **Electron 边界不变**：门禁脚本仍在 Node/Vitest；不因修测试引入新的主进程 IPC 通道。

## Risks / Trade-offs

- [Risk] 修协议常量牵动大量 executor 测试 → Mitigation：先对齐单一版本源，再跑相关测试文件。
- [Risk] 缩小硬门禁掩盖回归 → Mitigation：默认禁止；若做须写进 acceptance。

## Migration Plan

无用户数据迁移。合并后 CI/本地 `harness:gate` 应绿；main 三 change 可再走 `/story-done`。

## Open Questions

- 是否允许把 `test:agent-eval` 类套件移出硬门禁：默认否，待制作人确认。
