## Context

货架默认只显示一行（`shelfRowCapacity()` × `shelfGridExpanded`）。任务房布局下 `#workSurfaceWrap` 被收窄到约 280–400px。返回货架时若仍按该宽度量列数，会得到 capacity=1。

## Decision

1. `setSurface`：先 `onPageChange`（清 `data-workbench-layout`），再 `renderShelf`。
2. `closeExpertTaskRoom`：先 `onViewChange(false)` / `updateWorkbenchViewState(taskRoom:false)`，再 restore。
3. 进入 shelf 后 `requestAnimationFrame` 再 `paintShelfGrid` 一次，兜底 display/布局时序。

## Risks

- 提前 `onPageChange` 可能影响依赖旧 page 的渲染：当前 page handler 只改壳层 class，风险低。
