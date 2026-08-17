## Context

`replace-main-vm-with-modules` 废掉了 VM concat，但落地成编号切片。`cohesion-first-file-budget` 已把硬顶改为 2000、告警 1200，允许按域合并。

## Goals / Non-Goals

**Goals:** 具名、按变化原因合并；组合根显式；测试认新路径。
**Non-Goals:** 消灭 `scope`；改 IPC；迁 lib 算法。

## Decisions

1. **五模块（加载序 = 原 part 序）**
   - `boot.ts`：Electron/userData、lib require、路径与 Hub 工厂（原 part-01）
   - `agent-runtime.ts`：Team Runtime + Agent Package + 会话 store（原 02–03）
   - `shell.ts`：图标、窗口句柄、便签兼容、工作台/设置/记忆/日志窗（原 04–08）
   - `knowledge.ts`：内容源、语义索引、Fabric、Provider（原 09–11）
   - `workbench.ts`：货架/mode、工作台投影、`app.whenReady`、进程守卫（原 12–14）
2. **契约**：各文件导出 `attach(scope)`，禁止顶层 `require('./scope')` 隐式副作用（`index.ts` 除外先 `require('./scope')`）。
3. **仍用 `scope` 袋**：本波只换文件边界，不改 `ipc-bind.ts` 的 deps 扁平袋，避免 ai-generate 回归。
4. **禁止** vm concat、再开 `part-15`、为行数把五模块切碎。

## Electron 边界

Renderer → `window.api` → `src/ipc` → 主进程 `attach` 挂上的胶水 / `src/lib`。窗口工厂留在 `shell.ts`，不进 lib。

## Risks

| 风险 | 缓解 |
|------|------|
| 合并后加载序错 | 保持 01→14 的相对序 |
| 源码 grep 测试碎 | `readMainParts` 改读 `module-list.json` |
