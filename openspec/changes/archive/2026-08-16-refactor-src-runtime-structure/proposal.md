## Why

`src/main.js` 仍约 3200 行；`src/ipc`、`src/preload`、`src/workbench` 仍为 JS。需迁到 TypeScript 并拆薄组合根，与 `docs/architecture.md` 一致。

## What Changes

- `src/main.js` 降为 boot（register-ts + require 组合根，<100 行）
- 窗口/托盘/生命周期/IPC deps 拆到 `src/main/*.ts`（每文件 ≤400 行）
- `src/ipc/*.js` → `.ts`（IPC 名不变）
- `src/preload` → TypeScript
- `src/workbench/*.js` 纯规则迁 `src/domain`；`work-surface.js` 迁 domain
- 更新 `docs/architecture.md` 分层描述

## Capabilities

### New Capabilities

- `knowme-runtime-structure`: 主进程组合根、IPC、preload 的 TS 结构与文件预算

### Modified Capabilities

- （无产品行为变更）

## Impact

- 主进程、preload、IPC、测试 import 路径
- 非目标：消除全部 `src/lib` `@ts-nocheck`；改 Daemon 协议
