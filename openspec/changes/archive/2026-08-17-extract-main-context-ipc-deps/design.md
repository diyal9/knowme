## Context

`extract-main-named-modules` 留下 `scope.ts` 单例与扁平 `ipc-bind`。本波只动组合根与叶子，不重写五模块内部胶水。

## Goals / Non-Goals

**Goals:** 消灭模块级单例；IPC 袋按域写在一处；图标与进程守卫可单独改。
**Non-Goals:** 嵌套 IPC deps 签名；拆掉五模块内部 `scope.` 引用。

## Decisions

1. **上下文由组合根创建**：`index.ts` `Object.create(null)`，传入 `attach` 与 `bindCoreIpc`。禁止 `require('./scope')`。
2. **`createIpcDeps(ctx)`**：按 electron / paths / knowledge / workbench / agent / notes-compat / shell 分组字段，最后仍 `registerCoreIpc(ctx.ipcMain, flat)`。
3. **叶子**：`icons.ts`（品牌图标/托盘图）、`process-guards.ts`（quit / uncaught / GPU 子进程）。加载序：boot → agent-runtime → icons → shell → knowledge → workbench → process-guards → bindIpc。
4. **IPC 模块不改**：`assertRequiredDeps` 仍看扁平 key。

## Electron 边界

Renderer → window.api → `src/ipc` ← `createIpcDeps(ctx)`。窗口仍在 `shell.ts`。

## Risks

| 风险 | 缓解 |
|------|------|
| 漏 deps key | 结构测试仍断言关键 key；ai-generate 有 assertRequiredDeps |
| 加载序 | icons 必须在 shell 之前 |
