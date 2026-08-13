# Code Review: split-entry-ipc-workbench

## 范围

`src/ipc/*` strangler、`src/ipc/index.js` composition、`main.js` deps 注入、`src/workbench/*` 浏览器助手、合同与存量静态测试改查。

## 结论

**通过（ADVISORY 通过）**

## 要点

- IPC 按连续簇迁出，helpers 留 main，避免循环依赖
- `ai-generate` 大簇独立模块；与 `ai-assist` / fixture 非连续故分文件
- 合同测试改查 `src/ipc`，main 断言内联 `ipcMain` 归零
- Out of scope 遵守：未强拆 window/tray 生命周期与全量 workbench.js

## 风险

- deps 注入面大，后续漏注入会在运行时暴露 → 已有合同断言关键 deps 字段
- 手工 UI 冒烟未截图 → ADVISORY，不阻断归档

审查人：开发/制作人联合  
日期：2026-08-13
