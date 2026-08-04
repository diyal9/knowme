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
| `src/main.js` | 窗口、托盘、热键、持久化 |
| `src/preload.js` | `contextBridge` 最小 API |
| `src/note.html` | 便签 UI |
| `src/list.html` | 便签列表 |
| `src/settings.html` | 设置 |

# 安全原则

- 渲染进程 **禁用** `nodeIntegration`
- 禁止 `eval()`；IPC 仅暴露必要方法
- 详见 [Electron IPC](/concepts/electron-ipc.md)（knowledge）

# 性能

- 启动速度、多窗口内存占用为 C 端关键指标
- 自动保存 debounce 500ms，避免频繁 IO
