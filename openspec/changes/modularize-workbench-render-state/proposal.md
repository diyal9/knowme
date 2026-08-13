## Why

`src/workbench.js` 已超过 12K 行，渲染、事件绑定与 surface 状态机混在同一文件，回归成本高。`src/workbench/` 已有 escape/labels/provenance/run-phase 起步，需要按域继续 strangler，而不是一次性大搬家。

## What Changes

- 第一刀抽出 **surface 状态切换**（`setSurface` 及相关路由）与 **高频事件绑定** 到 `src/workbench/` 模块
- `workbench.js` 保留编排入口，调用抽离模块；行为不变
- 约定后续域拆分顺序：shelf/runner → studio → daemon runner → automation
- 不引入构建器 / TypeScript

## Capabilities

### New Capabilities

（无 — 纯重构，`skip_specs: true`）

### Modified Capabilities

（无 requirement 变更；延续 `entry-modularization` 已落地约定）

## Impact

- 代码：`src/workbench.js`、`src/workbench/*`、相关单测
- 风险：事件闭包与 DOM 引用断裂 → 用现有 workbench 冒烟与契约测试兜底
