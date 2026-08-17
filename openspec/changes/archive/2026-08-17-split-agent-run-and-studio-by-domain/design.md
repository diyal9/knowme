# Design: split-agent-run-and-studio-by-domain

## A. Agent Run Executor

```
src/lib/
  agent-run-executor.ts          # 组合根：run() 编排 + module.exports
  agent-run-executor/
    hints.ts                     # mergeArtifactRefs / missing-resource 提示
    result.ts                    # buildResult
    constants.ts                 # MAX_RECOVERY_ROUNDS / TOOL_EXEC_TIMEOUT_MS / ORCHESTRATION_TOOL_PATTERN
    phases-prepare-context.ts    # PREPARE + CONTEXT 相位（显式入参）
    phases-model-tool.ts         # MODEL ↔ TOOL 循环（显式入参）
    phases-ground-persist.ts     # GROUND / VERIFY_CLAIMS / PERSIST / DONE
```

### 决策

1. **显式参数，无神 ctx**：各相位函数接收命名 deps（`ports`、`input`、`assembler` 等），返回值携带下一阶段所需字段；不在子模块间共享可变 god object。
2. **组合根保留 run()**：局部状态（metrics、trace、assembler）仍在 `run()` 内声明，相位函数通过入参/返回值传递。
3. **导出不变**：`RunPhase`、`run`、`AgentRunExecutor`、`buildMissingResourceHint`。

## B. Agent Run Manager

```
src/lib/
  agent-run-manager.ts           # 组合根：AgentRunManager 类 + module.exports
  agent-run-manager/
    constants.ts                 # RUN_STATUSES / VALID_TRANSITIONS / …
    transitions.ts               # transitionRun / baseRunRecord / persistRun / broadcast
    lifecycle.ts                 # createRun / launch / cancel / finalize / retry
    children.ts                  # createChildRun / awaitRun / cancelAllChildren
    recovery.ts                  # resumeRun / loadFromStore / recoverAllFromStore
```

### 决策

1. **子模块导出 `(mgr, …)` 函数**，类方法薄包装 `return lifecycle.createRun(this, spec)`。
2. **状态机常量单一来源**：`constants.ts` re-export 到组合根 `module.exports`。
3. **语义不变**：`VALID_TRANSITIONS` 与 cancel budget 行为与拆分前一致。

## C. Studio — **不作拆分**

| 文件 | 行数 | 决策 |
|------|------|------|
| `workbench-studio-model.ts` | ~1157 | 保持单文件 IIFE |
| `workbench-studio-canvas.ts` | ~1003 | 保持单文件 IIFE |

**理由**：

1. model / canvas 已是两域边界，均低于 1200 行告警线。
2. normalize / draft / mutate / compile 共享 `NODE_KINDS`、`START_ID` 等常量与 `normalizeNode` 闭包，拆分会破坏 UMD `globalThis.WorkbenchStudio*` 单 bundle 约定且无独立第二变化轴。
3. canvas 的 summary / layout / edges 共用 `SIZE`、`makeSection` 与布局遍历，轻拆收益低于 UMD 兼容风险。
4. **不为行数硬锯** — 符合 cohesion-first 原则。

## 测试

定向：

- Agent：`agent-run-executor.test.js`、`agent-run-executor-grounding.test.js`、`agent-team-runtime-core.test.js`、`agent-team-runtime-integration.test.js`、`agent-runtime-production-readiness.test.js`
- Studio（回归）：`workbench-studio-model.test.js`、`workbench-studio-canvas.test.js`、`workbench-studio-free-graph.test.js`
