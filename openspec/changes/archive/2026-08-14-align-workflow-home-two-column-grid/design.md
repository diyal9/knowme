## Context

见 `proposal.md` — Why。首页 `.wb-shelf-grid` 现为 `repeat(auto-fill, minmax(272px, 1fr))`，宽屏易出三列；管理页 `.wb-workflow-manage-list` 已为 `repeat(2, minmax(0, 1fr))`。

## Goals / Non-Goals

**Goals:**

- 首页货架与管理页共用两列网格语义
- 改动仅限渲染层 CSS，不碰主进程 / IPC

**Non-Goals:**

- 不统一两页的卡片 DOM 结构
- 不调整 agent shelf（`.wb-agent-grid`）

## Decisions

1. **固定两列而非提高 minmax**  
   - 选用：`grid-template-columns: repeat(2, minmax(0, 1fr))`，与 `.wb-workflow-manage-list` 一致  
   - 备选：增大 `minmax` 阈值（如 360px）——仍可能在超宽屏出三列，且与管理页不完全一致

2. **窄屏**  
   - 保留现有 `@media (max-width: 900px)` 将 `.wb-shelf-grid` 设为 `1fr`

## Risks / Trade-offs

- [Risk] 工作流很多时纵向更长 → 已有「展开更多」滚动区可承接；不本次改交互
- [Trade-off] 两列单卡更宽，简要流程标签更不易截断，符合诉求

## Migration Plan

纯 CSS；热重载或重启应用即可。回滚即恢复 `auto-fill` 规则。
