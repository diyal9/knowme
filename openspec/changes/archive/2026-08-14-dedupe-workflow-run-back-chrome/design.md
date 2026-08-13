## Context

See proposal.md — Why。`simplify-workflow-run-topbar` 已在运行壳内恢复 `#wbRunBack`，但 `syncHeadActionButton` 仍对「运行 + workflow」显示 `#wbReload` chevron，且 mode tabs 已隐藏，导致 `.wb-head` 几乎只剩空条 + 返回。

渲染进程内状态同步即可；不涉及主进程 / IPC。

## Goals / Non-Goals

**Goals:**
- 工作流运行面返回入口唯一：`#wbRunBack`
- 隐藏运行态空 `.wb-head`，减少垂直浪费

**Non-Goals:**
- 不改专家任务房 / Studio 的顶栏返回策略
- 不改 `backToRunList` 行为

## Decisions

1. **隐藏条件**：`activeSurface === 'run' && !expertTaskRoom` 时隐藏 `.wb-head`；专家任务房仍依赖顶栏返回（任务仪表盘被隐藏）。
2. **`syncHeadActionButton`**：`showBack` 仅保留 `studio` 与 `expertTaskRoom`；去掉「run + workflow」分支。
3. **给 `.wb-head` 加 `id="wbHead"`**，便于显隐与测试选择器稳定。

## Risks / Trade-offs

- [Risk] 某条进入 run 却无 `#wbRunBack` 可见的路径会丢退路 → Mitigation：仅在非专家任务房的 run 隐藏头；`#wbRunBack` 始终在 `wb-run-shell` 内。
- [Risk] 离开 run 后头栏未恢复 → Mitigation：在 `syncModeTabs` / `syncHeadActionButton` 统一复位 `hidden`。
