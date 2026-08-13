## Context

货架卡片由渲染进程 `shelfCardHtml` 生成；package 真源已含 `updatedAt` / `createdAt`（`workflow-package` normalize）。工作台已有 `wbRelTime`。见 proposal.md - Why。不涉及主进程 / IPC。

## Goals / Non-Goals

**Goals:**

- 页脚左下展示相对「最近更新」；悬停给绝对时间。
- CSS 左右分布，不挤压右下图标按钮。

**Non-Goals:**

- 不新增 IPC、不改 schema、不改排序。
- 不引入新时间工具库。

## Decisions

1. **数据源**：`item.updatedAt || item.createdAt`。官方/团队包若只有创建时间，仍显示可理解的时间。
2. **展示格式**：复用 `wbRelTime`（如「3 天前」），前缀「更新于」；`<time datetime>` + `title` 放本地可读绝对时间。相对时间扫读更轻，绝对时间用悬停补全。
3. **布局**：`footer` 用 `justify-content: space-between`；左侧 `.wb-shelf-updated`，右侧包一层 `.wb-shelf-actions` 放按钮，避免按钮被拉开。
4. **空值**：`wbRelTime` 为空则不渲染时间节点，footer 仍右对齐操作区。

## Risks / Trade-offs

- [相对时间随页面停留变旧] → 与任务列表一致；货架刷新时重算即可，不单独定时刷新。
- [极旧包显示「N 年前」偏长] → 样式用 muted 小字 + ellipsis，不抢标题层级。

## Migration Plan

纯前端展示；无需数据迁移。回滚即去掉页脚时间节点与相关 CSS。
