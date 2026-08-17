## 1. create(ctx)

- [x] 1.1 全部 `attach` 改为 `create(ctx)`，模块内 `scope.` 改为 `ctx.`
- [x] 1.2 `index.ts` 调用 `create(ctx)`

## 2. IPC 按域 pick

- [x] 2.1 `createIpcGroups` + `registerCoreIpc(ipcMain, groups)` 对每个通道 pick
- [x] 2.2 结构测试与 lint / typecheck:renderer 绿
