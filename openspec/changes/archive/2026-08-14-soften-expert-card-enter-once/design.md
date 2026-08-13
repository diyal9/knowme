## Context

专家库 grid/featured 与工作台 `wb-task-quick-card` 在 CSS 上默认挂入场动画，且 `innerHTML` 重绘会重播。

## Goals / Non-Goals

- Goals: 减弱观感；会话内首次出卡播一次；切页/筛选不再闪
- Non-Goals: 不改卡片布局、hover、数据加载逻辑

## Decisions

1. **门控 class**：动画只在容器带 `is-entering` 时生效（如 `.hub-grid.is-entering .hub-card`）。
2. **一次性 flag**：模块内 `enterPlayed`；首次非 loading 且有卡片渲染后加 `is-entering`，动画结束后移除；之后不再加。
3. **减弱参数**：起始 opacity ≈ 0.92，translateY ≈ 3px，时长 ≈ 240ms，stagger ≈ 20ms，cap ≈ 120ms；fill-mode 用 `forwards` 或保持短 both 但因起始接近可见，闪感弱。
4. **骨架屏**：loading skeleton 不计入「首次播放」；等真实卡片再播。

## Risks

- iframe 每次重新加载专家库仍会播一次（符合「首次加载」语义）。
