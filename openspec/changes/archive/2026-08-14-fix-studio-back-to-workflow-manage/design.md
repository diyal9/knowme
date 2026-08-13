## Context

`relocate-workflow-copy-to-manage` 后，个人流程的编辑/复制/删除在「管理工作流」；货架卡只保留运行。但 `leaveStudioToShelf()` 仍 `setSurface('shelf')`，与入口脱节。

运行面已有 `captureTaskRoomReturnState` / `restoreTaskRoomReturnState`；编排面可复用同一「进入时捕获一层来源」模式，不必引入完整历史栈。

## Goals / Non-Goals

- Goals：返回与离开确认按来源回到管理或货架；默认管理。
- Non-Goals：改 Tab 信息架构、改保存落盘逻辑。

## Decisions

1. **捕获时机**：`openOrchestration` 在首次从非 studio 切入时写入 `studioReturnState`；同页切换草稿不覆盖。
2. **默认目标**：未知来源（深链等）→ `openManagePanel('workflows')`。
3. **货架来源**：仅当进入前 `activeSurface === 'shelf'` 时回货架（空态新建等）。
4. **函数名**：保留 `leaveStudioToShelf` 调用点，内部改为按 `studioReturnState` 恢复，避免大范围改名噪音。
5. **按钮文案**：管理来源/默认 →「返回管理工作流」；货架来源 →「返回工作流」。

## Risks / Trade-offs

- 旧契约测试断言「离开回货架」会失败 → 同步改断言。
- 模式 Tab 兜底里调用 `leaveStudioToShelf` 后再切 Tab：若先打开 manage 再被 Tab 覆盖，行为仍正确（Tab 目标优先）。

## Migration

无需数据迁移；仅导航状态。
