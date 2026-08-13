## Context

任务与工作流已共用 `workbench-tasks.json`；从货架进入对话房时会写入带 `workflowId` 的任务。任务 Tab 已有「最近任务」卡片网格 + 折叠预览；工作流 Tab 货架（`#wbShelfSurface`）目前只有筛选、摘要与卡片网格，下方留白。

## Goals / Non-Goals

**Goals**

- 在货架下方复用最近任务卡片 UI，展示 `workflowId` 非空任务。
- 任务 Tab 最近任务过滤掉工作流任务，避免重复。
- 点击打开走既有 `openTaskFromRecent`。

**Non-Goals**

- 新 store / IPC / 状态机。
- 按领域筛选联动过滤工作流任务。
- 定时按钮行为变更（工作流任务可保留或隐藏定时；默认与专家任务一致保留）。

## Decisions

1. **分流规则**：`String(task.workflowId || '').trim()` 非空 → 工作流任务区；否则 → 任务首页最近任务。
2. **DOM**：在 `#wbShelfSurface .wb-shelf` 内、网格之后增加 `wb-shelf-recent` 面板（label「工作流任务」、列表、更多、空态），样式复用 `wb-task-home-panel` / `wb-task-recent-list`。
3. **刷新时机**：`renderShelf()` 异步拉取 task list 并 `paintShelfRecentList()`；`renderTaskHome` / 任务创建更新后若当前在 shelf 也刷新该区。
4. **预览条数**：复用 `TASK_RECENT_PREVIEW`（3）与独立 `shelfRecentExpanded` 状态。

## Risks / Trade-offs

- 旧数据若误标 `workflowId` 会从任务 Tab「消失」——可接受，与三 Tab IA 一致。
- 货架很长时任务区需滚动才可见——与任务 Tab「上快捷下最近」一致，可接受。

## Migration

无。已有带 `workflowId` 的任务立即出现在新区域。
