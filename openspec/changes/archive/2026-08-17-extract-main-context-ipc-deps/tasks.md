## 1. 上下文与 IPC 袋

- [x] 1.1 `index.ts` 创建 `ctx` 并传入 attach / bindCoreIpc；删除 `scope.ts`
- [x] 1.2 以 `ipc-deps.ts` 替换 `ipc-bind.ts`：`createIpcDeps(ctx)` 按域分组，`bindCoreIpc(ctx)`
- [x] 1.3 抽出 `icons.ts`、`process-guards.ts` 并更新 `module-list.json`

## 2. 测试与文档

- [x] 2.1 结构测试：无 `scope.ts`、`attach(ctx)`、`registerCoreIpc(ctx.ipcMain)`；bundle 读 `ipc-deps.ts`
- [x] 2.2 更新 `docs/architecture.md`；lint / typecheck:renderer / 结构测试绿
