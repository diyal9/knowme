## Context

工作台任务 Tab（`wbTaskSurface`）自上而下为「快捷任务」与「你的任务」。最近任务由 `renderTaskHome()` 全量渲染到 `#wbTaskRecentList`，任务一多首屏被列表占满。`wb-body` 已有 `overflow-y:auto`，但默认仍应优先一屏看完摘要。

## Goals / Non-Goals

**Goals**

- 默认预览有限条最近任务，保证常见窗口下任务首页一屏可读完。
- 「更多 / 收起」切换展开态；展开后列表可滚动浏览剩余项。
- 复用现有 `wb-list-toggle` 视觉语言，改动面最小。

**Non-Goals**

- 服务端分页、无限滚动加载。
- 改任务打开、创建、归档逻辑。

## Decisions

1. **预览条数固定为 3**  
   与当前快捷任务三卡并排的首屏节奏匹配；少于等于 3 条不显示切换按钮。

2. **折叠态只渲染可见行**（非 CSS hide）  
   折叠时 `slice(0, 3)` 渲染，展开时渲染全部；状态 `taskRecentExpanded` 保存在渲染模块闭包。

3. **展开后列表自带滚动**  
   `.wb-task-recent-list.is-expanded` 设 `max-height` + `overflow-y:auto`，避免展开后把整页拉得过长；`wb-body` 仍保留页面级滚动作为兜底。

4. **切换文案**  
   折叠：`更多（剩余 N）`；展开：`收起`。`aria-expanded` 同步。

## Risks / Trade-offs

- 固定 3 条在超小窗口仍可能略挤 → 依赖 `wb-body` 滚动兜底，可接受。
- 刷新 `renderTaskHome` 会重置展开态为折叠 → 符合「默认部分展示」预期。

## Migration Plan

无需数据迁移。

## Open Questions

无。
