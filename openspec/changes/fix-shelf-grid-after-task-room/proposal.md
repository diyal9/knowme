## Why

从工作流任务对话房点返回回到「工作流」货架时，货架只渲染 1 张卡片并显示「更多（N）」。根因是 `setSurface('shelf')` 在清除 task-room 窄栏布局之前就按 `clientWidth` 计算一行容量，把列数误算成 1。

## What Changes

- 切回货架前先退出 task-room 布局（全宽），再计算一行容量并渲染。
- `closeExpertTaskRoom` 先清壳层 `workbench-layout`，再 `restoreTaskRoomReturnState`。
- 布局稳定后补一次货架网格重绘，避免量宽竞态。

## Capabilities

### New Capabilities

- `workbench-workflow-shelf-layout`: 从任务房返回货架时，一行容量按全宽货架计算。

### Modified Capabilities

- （无）

## Impact

- `src/workbench.js`：`setSurface` / `closeExpertTaskRoom` / 货架重绘时机
- 回归断言：`tests/workbench-templates.test.js`
