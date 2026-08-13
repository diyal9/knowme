## Context

See proposal.md — Why。货架 CSS 已是 `repeat(2, …)` / `@media (max-width: 900px)` 单列，但 `shelfRowCapacity()` 仍用旧 `auto-fill` 公式，宽屏常返回 3，与真实一行容量不一致。

## Goals / Non-Goals

- Goals：摘要并入筛选行；折叠预览行容量与 CSS 列数一致
- Non-Goals：不改展开态滚动/锁定逻辑；不改摘要文案算法

## Decisions

1. **DOM**：把 `#wbShelfSummary` 移入 `.wb-shelf-filters`，放在 `#wbDomainSwitcher` 与 `#wbShelfManage` 之间；沿用 manage 的 `margin-left:auto` 把按钮顶到右侧。
2. **行容量**：`shelfRowCapacity()` 改为按断点返回 `1` 或 `2`（与 `.wb-shelf-grid` 列数一致），不再用 `SHELF_CARD_MIN_WIDTH` 估算；可删除不再使用的常量。
3. **空摘要**：`:empty { display:none }`，无文案时不占位。

## Risks / Trade-offs

- [Risk] 断点若与 CSS 漂移 → Mitigation：常量与 `@media (max-width: 900px)` 注释对齐，测试锁定 2 列公式

## Open Questions

（无）
