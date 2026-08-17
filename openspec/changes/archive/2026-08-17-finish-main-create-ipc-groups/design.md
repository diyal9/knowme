## Context

前两波留下 `attach` 与扁平 `createIpcDeps`。用户要求一次做完，不再分期。

## Decisions

1. `attach` 全部改为 `create(ctx)`，模块内统一 `ctx.`（不再用参数名 `scope`）。
2. `createIpcGroups` 返回 `{ electron, paths, knowledge, workbench, agent, notesCompat, shell }`。
3. `registerCoreIpc(ipcMain, groups)` 用 `pick(groups, ...domains)` 注入；简单通道只拿所需域，`ai-generate` 等拿全域。
4. 运行时交叉引用仍写在 `ctx` 上（Hub 回调 mode store 等），不假装已无共享图。

## Electron 边界

Renderer → window.api → register*Ipc(pick(groups)) → lib / 窗口工厂。
