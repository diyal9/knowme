## Context

`fix-workbench-back-navigation` 已按来源恢复一级面，但冷启动走 `restoreTaskFromDraft` → `openDaemonTask(slug, { silent: true })` 时未写入 `returnSurface`，在 `activeSurface` 已是 `taskhome`/`shelf` 时会把来源记错。`backToRunList` 又 `await refreshRunDirectory()`（全量 `workbenchLoad`），造成返回卡顿。

## Goals / Non-Goals

**Goals**

- 冷启动不打开已失效 Daemon 任务房
- Daemon 恢复默认回管线；显式 `returnState` 仍优先
- 返回先导航后刷新

**Non-Goals**

- 不改任务状态机或日志 SSE
- 不强制所有 Daemon 运行一律回管线（货架启动仍回货架）

## Decisions

1. **恢复门禁**：`draft.slug` 仅在 phase 非终态，且（管线离线 或 slug 仍在 `data.daemon.tasks`）时打开；否则清草稿并返回 false。
2. **默认来源**：`openDaemonTask` 在无 UI/显式来源时默认 `daemon`；`openExistingLaunchRun` / `restoreTaskFromDraft` 传入 `intent.returnState?.surface || 'daemon'`。
3. **返回时序**：`backToRunList` / `backDaemonRunToPipelineTasks` 先 `resetRun` + `restoreTaskRoomReturnState`，再 `void refreshRunDirectory()`。
4. **静默失败**：`silent` 打开后若状态刷新失败（任务不存在等），清草稿、清空 run，不滞留运行面。

## Risks / Trade-offs

- 管线刚上线、tasks 列表尚未刷新时可能误判「不在列表」→ 以 bootstrap 已带 tasks 为准；离线时仍允许按 slug 恢复以免丢进行中任务。
- 清草稿不可恢复 → 仅清明确失效/终态路径，进行中且在列表中的保留。

## Migration

无数据迁移；仅本地 `taskDraft` / launchIntent 清理逻辑。
