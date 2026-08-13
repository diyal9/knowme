## Context

编排默认是专业画布（`studioSimpleMode=false`）。打开线性/空草稿时，`renderStudioBoardGraph` 每次调用 `ensureFreeGraph`，后者在 linear→free 时写死 `dirty: true`。保存成功后仍 `renderStudio()` 再 `setSurface('shelf')`，脏草稿留在货架会话里；再点卡片「编辑」走 `openOrchestration({ workflowId })` → `confirmLeaveStudio()` → 误弹窗。

## Goals / Non-Goals

- Goals: 打开/渲染/保存后回到货架不产生假 dirty；真编辑仍受离开门禁保护。
- Non-Goals: 改离开文案、持久化未保存草稿到磁盘、改简单步骤模式。

## Decisions

1. `ensureFreeGraph(draft, { markDirty })`：默认 `markDirty=true`（用户操作路径）；渲染传 `false`，只升级图结构并保留原 dirty。
2. `confirmLeaveStudio` 用「非 start/end 节点」判断是否有可丢失内容，避免空画布仅系统节点也弹窗。
3. `saveStudioWorkflow` 成功后、切货架前强制 `studioDraft.dirty = false`（双保险）。

## Risks

- 若未来「线性→自由」本身需要强制用户保存才能保留布局：当前布局由确定性算法生成，不持久化也可复现；真改节点/边仍会 dirty。
