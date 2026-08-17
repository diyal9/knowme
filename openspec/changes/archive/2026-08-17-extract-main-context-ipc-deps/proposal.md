## Why

上一波只把 `part-*` 换成具名 `attach(scope)`，`scope.ts` 仍是模块级单例，`ipc-bind.ts` 自己再 `require('./scope')`。组合根无法注入上下文，IPC 依赖仍是一长串无分组字段。本波拆掉单例、按域组装 IPC 袋，并抽出图标与进程守卫两个叶子模块。

## 目标用户

改主进程 / IPC 接线的开发者：能在 `index.ts` 看到上下文从哪来，在 `ipc-deps.ts` 按域找依赖，而不是猜全局 `scope`。

## 验收标准

- 无 `src/main/scope.ts`；组合根 `const ctx = Object.create(null)` 后 `attach(ctx)`，再 `bindCoreIpc(ctx)`。
- `ipc-deps.ts` 导出 `createIpcDeps(ctx)` / `bindCoreIpc(ctx)`，按域分组；`registerCoreIpc` 仍收扁平袋（不改各 `src/ipc/*` 签名）。
- `icons.ts`、`process-guards.ts` 为具名叶子；`shell` / `workbench` 不再内含这两块。
- 产品 IPC 与窗口行为不变。
- lint / typecheck:renderer / 主进程结构测试绿。

## 非目标（Non-goals）

- 不改各 `register*Ipc` 入参为嵌套对象。
- 不把 `boot`/`agent-runtime`/`knowledge` 内部的 `scope.x` 全部改成局部绑定。
- 不改 IPC 通道名、不恢复便签窗、不用 vm concat。

## What Changes

见 design.md。

## Capabilities

### New Capabilities

- `main-context-ipc-deps`: 组合根持有 ctx；IPC 依赖按域组装；无模块级 scope 单例

### Modified Capabilities

- `main-named-modules`: 增加 icons / process-guards 叶子

## Impact

`src/main/index.ts`、`ipc-deps.ts`、删除 `scope.ts` / `ipc-bind.ts`、结构测试。
