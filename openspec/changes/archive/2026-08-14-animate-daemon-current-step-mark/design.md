## Context

步骤时间线已有 `status-active` / `status-running` / `status-waiting` / `is-current` 静态样式（暖色描边 + 轻阴影），但无动画，扫读时仍像「空心灰点」。用户反馈要求当前点「有动作」。

## Goals / Non-Goals

**Goals**

- 当前节点圆点：填充色 + 外扩脉冲环（`box-shadow` 或 `::after`），约 1.4–1.8s 无限循环。
- `prefers-reduced-motion: reduce` 下关掉动画，保留静态暖色高亮。

**Non-Goals**

- 不改 `nodeVisualStatus` 投影语义（除非发现当前态未打上 class，再最小补齐）。
- 不动画化整张微卡。

## Decisions

1. **纯 CSS**：挂在已有 `.status-active` / `.status-running` / `.status-waiting` / `.is-current` 的 `.wb-daemon-review-step-mark` 上。
2. **实心核 + 扩散环**：比空心白底更易感知「活着」；环用 `::after` 缩放+淡出，避免整点缩放晃动轴线。
3. **复用 `--wb-warning`**：与现有当前态色一致。

## Risks / Trade-offs

- 轮询整页重绘可能重置 CSS 动画：可接受；若抖动明显再改为不整块重绘（超出本 change）。
- 过强光晕像告警：控制透明度与周期，克制即可。

## Migration

无。
