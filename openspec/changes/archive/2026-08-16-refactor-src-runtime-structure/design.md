## Context

Renderer 已 React/TS；`src/lib` 已 TS + register-ts。主进程组合根与 IPC 层仍是上帝 JS 文件。

## Goals / Non-Goals

**Goals:** 薄 boot；main/ipc/preload/workbench 迁 TS；每 TS 文件 ≤400 行；门禁全绿。

**Non-Goals:** lib nocheck 清零；便签数据模型再设计；IPC 重命名。

## Decisions

1. `package.json` `main` 仍 `src/main.js`，仅 `require('../scripts/register-ts')` + `require('./main/index')`。
2. `register-ts.js` 继续解析 `.js` → `.ts`，ipc/preload 可保留薄 `.js` boot 或直接 `.ts`。
3. `src/workbench/*` 展示标签与 run-phase 进 `src/domain/`（无 DOM）。
4. `registerCoreIpc` 仍在 `src/ipc/index.ts`，deps 由 `src/main/ipc-deps.ts` 组装。
5. 便签兼容函数保留最小 stub（workspace-init 仍读 notes 目录），不恢复便签窗。

## 删 / 留 / 迁

| 删 | 留 | 迁 |
|----|----|----|
| `src/workbench/*.js`（迁后） | `attention-toast.html` | main 体 → `src/main/*.ts` |
| 便签窗创建逻辑 stub | assets/vendor | ipc → `.ts` |
| | preload 暴露面 | preload → `.ts` |
