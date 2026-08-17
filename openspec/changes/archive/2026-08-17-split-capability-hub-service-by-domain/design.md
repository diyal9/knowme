# Design: split-capability-hub-service-by-domain

## 目录结构

```
src/lib/
  capability-hub-service.ts   # 组合根：createCapabilityHubService + module.exports re-export
  capability-hub-map.ts       # 兼容壳 → re-export capability-hub/map
  capability-hub/
    map.ts                    # 映射 / session 投影 / minimal-package（自 capability-hub-map 迁入）
    runtime.ts                # skillRuntime / expertRuntime / sandbox / installStoreMap
    lifecycle.ts              # list/install/import/favorites/cursor/enable/disable…
    experts.ts                # save/delete/publish/backfill
    session-context.ts        # buildSkillTools / assemble / sessionDto / knowledge patch
    ipc.ts                    # IPC_CHANNELS + registerIpcHandlers
```

## 决策

1. **map 单一来源**：`capability-hub/map.ts` 为 canonical；`capability-hub-map.ts` 与 service 根 `module.exports` 均 re-export，删除 service 内重复实现。
2. **域工厂**：各模块导出 `createXxx(deps)`，deps 为显式字段（store、catalogApi…），禁止 `{ ctx }` 神对象。
3. **组合根**：`createCapabilityHubService` 实例化 store/runtime/lifecycle/experts/session/ipc，合并 return 对象；行为与拆分前一致。
4. **IPC 不变**：`IPC_CHANNELS` 与 `ipcMain.handle` 通道名保持原样。

## 测试

定向：`capability-hub.test.js`、`capability-integration.test.js`、`session-knowledge-scope.test.js`、`skill-task-catalog.test.js`。
