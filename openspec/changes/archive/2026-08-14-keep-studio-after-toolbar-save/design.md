## Context

See proposal.md — Why。当前 `saveStudioWorkflow` 在持久化成功后无条件 `setSurface('shelf')`，工具栏保存与「保存后离开」共用该函数，导致中途存档也被导航走。

## Goals / Non-Goals

**Goals:**
- 把「持久化」与「离开编排」解耦：保存函数只写盘 + 刷新货架数据 + 清 dirty；导航只在 `leaveStudioToShelf`（及同类离开入口）发生。
- 保持渲染进程内状态一致：保存后草稿仍绑定刚写入的 package，便于继续编辑。

**Non-Goals:**
- 不改 IPC / 主进程包存储。
- 不为测试运行新增独立「不保存」路径。

## Decisions

1. **从 `saveStudioWorkflow` 删除 `setSurface('shelf')`**  
   - 备选：给 `saveStudioWorkflow({ navigateToShelf })` 加选项 — 否决，离开路径已有 `leaveStudioToShelf`，多余参数易再耦合。
2. **保留 `renderShelf()` / `renderWorkflowManage()`**  
   - 后台刷新「我的」列表，用户返回时数据已最新。
3. **`leaveStudioToShelf` 仍在确认后 `setSurface('shelf')` + `clearStudioDraftMemory()`**  
   - 「保存后离开」：先 save（留在 studio 一瞬）再由 leave 切货架；用户无感知闪烁可接受（同 tick 内完成）。

## Risks / Trade-offs

- [Risk] 依赖旧「保存即回货架」的手测脚本会失败 → 更新 qa / 静态测试断言。
- [Risk] 保存后草稿仍在内存，若用户以为已离开 → 状态文案「已保存」+ dirty=false 已足够；真离开仍走返回按钮。
