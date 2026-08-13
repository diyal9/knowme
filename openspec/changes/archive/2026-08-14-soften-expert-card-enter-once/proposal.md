## Why

专家库与工作台任务页的专家卡片使用 `hub-rise` / `wb-task-quick-rise`（opacity 0 + 错峰 delay + `both`）。切页或重绘时整排从透明升起，观感像闪动。

## What Changes

- 减弱入场动画：更高起始透明度、更短位移与时长、更小 stagger
- 仅在**首次加载出真实卡片**时播放一次；后续筛选/切回/重绘不再重播
- `prefers-reduced-motion` 下仍不播放

## Capabilities

### New Capabilities

- `expert-card-enter-motion`: 专家卡片入场动效策略（减弱 + 仅首次）

### Modified Capabilities

- （无主规格增量以外的行为变更）

## Impact

- `src/capability-hub.css` / `src/capability-hub.js`
- `src/workbench-layout.css` / `src/workbench.js`
