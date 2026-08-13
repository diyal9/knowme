## Context

任务首页已有 `openTaskComposer` / `openTaskScheduleHub`；定时入口在 `#wbTaskAutomation`。知识库复选框落在 `.wb-studio-field` 内，被 `input { width:100% }` 拉破。删除复用主进程 `workbench-task-archive`（preload 已暴露）。

## Goals / Non-Goals

**Goals:**
- 渲染进程替换入口与弹窗 UX；批量归档走现有 IPC
- 专家选择自定义简卡下拉，避免原生 `<select>` 无法带头像

**Non-Goals:**
- 不改主进程 scheduler tick / store schedule 字段 schema
- 不引入新依赖

## Decisions

1. **入口复用 `#wbTaskAutomation`**：改 id 语义为「管理最近任务」，图标 `settingsLine`，避免大面积改事件绑定名时可同步 rename 为 `wbTaskManage`。
2. **批量删除 = 连续 `workbenchTaskArchive`**：无新 IPC；失败 toast 汇总。
3. **专家选择**：hidden input 存 id + trigger/menu 简卡；去掉独立 summary 区块以免重复。
4. **知识库修复**：`.wb-task-knowledge-option input` 覆盖为 `width:auto`，单列布局更稳。

## Risks / Trade-offs

- [已设定时的任务仍可能被 tick 触发] → Mitigation：本 Story 仅去 UI；后续可另开 Story 关闭 scheduler
- [自定义下拉无原生 a11y] → Mitigation：键盘 Escape 关闭、aria-expanded、role=listbox
