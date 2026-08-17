## Why

主进程重构不应再拆成「下一波」。本 change 一次做完：模块入口统一为 `create(ctx)`；IPC 组合根按域 `pick` 注入，不再把整袋无差别塞给每个 registrar。

## 目标用户

主进程/IPC 开发者：看 `index.ts` 与 `ipc/index.ts` 就能知道谁创造上下文、每个通道拿哪些域。

## 验收标准

- 无 `attach(` 入口；具名模块导出 `create(ctx)`。
- `createIpcGroups(ctx)` 返回分组对象；`registerCoreIpc(ipcMain, groups)` 对每个 registrar `pick` 所需域。
- 产品行为与 IPC 通道名不变。
- lint / typecheck:renderer / 主进程结构测试绿。

## 非目标

- 不把 `ctx.foo` 全部改成无共享袋的纯函数（运行时交叉引用仍走 ctx）。
- 不改 IPC 通道名、不恢复便签窗。

## What Changes

见 design.md。

## Capabilities

### New Capabilities

- `main-create-ipc-groups`: create(ctx) + IPC 按域 pick

## Impact

`src/main/*`、`src/ipc/index.ts`、结构测试。
