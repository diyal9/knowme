## ADDED Requirements

### Requirement: Full-width shelf capacity after leaving task room

从工作流/专家任务房返回「工作流」货架时，系统 MUST 在 task-room 窄栏布局解除后，再按全宽货架计算一行卡片容量并渲染；MUST NOT 在仍处于 task-room 收窄宽度时把一行容量误算为 1。

#### Scenario: Return from workflow task room shows a full preview row

- **WHEN** 用户从工作流任务对话房返回货架，且可展示工作流数大于一行容量
- **THEN** 默认预览行按全宽列数渲染（常见桌面宽度下多于 1 张），并显示「更多」仅覆盖超出该行的剩余卡片

#### Scenario: Layout cleared before shelf paint

- **WHEN** `setSurface('shelf')` 因离开任务房被调用
- **THEN** 系统先清除壳层 task-room 布局（`data-workbench-layout` / `workbench-task-active`），再执行货架网格渲染

#### Scenario: Deferred remeasure after surface switch

- **WHEN** 进入货架面后首帧布局尚未完全稳定
- **THEN** 系统在下一帧再次按当前宽度重绘货架网格，纠正错误的一行容量
