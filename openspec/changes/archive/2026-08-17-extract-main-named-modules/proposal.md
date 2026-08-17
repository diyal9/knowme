## Why

主进程仍是 `part-01`…`part-14` 按行数切开的上帝文件，共享 `scope` 神对象。开发者无法按窗口、知识、Agent 运行时定位代码，后续改动容易改错切片。本 change 按职责合并为具名模块，组合根显式 `attach`，不改产品行为。

## 目标用户

后续改 Electron 主进程的开发者：按 boot / Agent 运行时 / 壳窗口 / 知识源 / 工作台 五个变化原因改文件，而不是猜 `part-xx`。

## 验收标准

- `src/main/` 无 `part-*.ts`；`index.ts` 只 `require` 具名模块并 `attach(scope)`。
- 行为不变：IPC 方法名、窗口种类、Agent/知识胶水逻辑保持。
- `npm test` / `npm run lint` / `npm run typecheck:renderer` 绿。
- 测试不再依赖 `part-\\d+` 文件名。

## 非目标（Non-goals）

- 本 change 不拆除共享 `scope` 袋（下一波再按域 DI）。
- 不改 IPC 通道、不恢复便签窗、不用 vm concat。
- 不把 `BrowserWindow` 逻辑迁入 `src/lib`。
- 不重写 Agent 循环 / 工具面算法。

## What Changes

- 按职责合并切片为 `boot`、`agent-runtime`、`shell`、`knowledge`、`workbench`。
- `index.ts` 组合根；`module-list.json` 列出具名加载序。
- 更新 `docs/architecture.md` 与主进程源码拼接测试。

## Capabilities

### New Capabilities

- `main-named-modules`: 主进程按职责具名模块 + attach 组合根

### Modified Capabilities

- （结构债，产品行为保持）

## Impact

`src/main/*`、`tests/helpers/main-ipc-bundle.js`、架构文档。
