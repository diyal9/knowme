---
type: Concept
title: Electron 架构
description: KnowMe 主进程、预加载、渲染进程分工与 IPC 安全。
tags: [architecture, electron, ipc, security]
timestamp: 2026-07-01T00:00:00Z
---

# 文件

| 文件 | 职责 |
|------|------|
| `src/main.js` | 薄 boot → 主进程 TypeScript 模块 |
| `src/preload.js` | `contextBridge` 最小 API |
| `src/renderer/` | 工作台 React/TS 渲染层 |
| `src/shared/api.ts` | IPC DTO 唯一源 |

详见仓库 `docs/architecture.md`。

# 安全原则

- 渲染进程 **禁用** `nodeIntegration`
- 禁止 `eval()`；IPC 仅暴露必要方法
- 详见 [Electron IPC](/concepts/electron-ipc.md)（knowledge）

# 性能

- 启动速度与内存占用为 C 端关键指标
- 日常开发用 Vite HMR（`npm start`），不为看 UI 先编 dist
