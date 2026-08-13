# Dev self-test — fix-studio-false-dirty-leave-guard

Date: 2026-08-12

## Commands

- `npm test` → 1705/1705 pass
- `npm run lint` → lint ok, script-scope ok

## Focus

- `tests/workbench-studio-free-graph.test.js` — `markDirty:false` keeps dirty false
- `tests/fix-studio-false-dirty-leave-guard.test.js` — render/save/leave/noop contracts
- `tests/polish-capability-and-workflow-authoring.test.js` — leave guard still present

## Round 2 (false dirty recurrence)

根因补充：画布内联失焦与检查器 sync 在内容未变时仍 `updateDraft`/`updateNode`（强制 dirty）；无流程字段时 sync 还会把 goal/IO 写成空。货架点「编辑」时若内存仍有 dirty 草稿就会再弹离开确认。

修复：
- noop 内联/检查器不同步
- 无流程字段时跳过 workflow sync
- `leaveStudioToShelf` 成功离开后清空内存草稿

## Manual check (after restart)

1. 工作台 → 工作流 → 点「我的」卡片编辑 → 应直接进入编排，不弹「还没保存」
2. 点开节点内联字段后不改内容再失焦 → 返回货架不应弹离开确认
3. 在编排里真正改一个节点 → 返回 → 仍应出现三选一离开确认
4. 保存或放弃后回到货架，再点另一张卡的编辑 → 不应误弹离开确认
