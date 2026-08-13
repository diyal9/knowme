## Context

结束态动作曾右对齐；`#wbRunBack` 与「回到货架」曾共用 `backToRunList()`，Daemon 常误回 shelf/taskhome。See proposal.md。

## Goals / Non-Goals

**Goals:** 结果按钮居中；Daemon 顶栏返回强制管线任务；货架按钮分流。  
**Non-Goals:** 不改 HITL 协议实现细节。

## Decisions

1. CSS：仅 `.wb-run-result-actions` 改为 `justify-content:center`（输入态保持右对齐）。
2. 分流：`backDaemonRunToPipelineTasks()`（顶栏，`surface:'daemon'`）；`backRunResultToShelf()`（「回到货架」→ shelf）。
3. HITL：既有对话卡，不在本变更扩里程碑投影。

## Risks / Trade-offs

- [用户从货架开 Daemon 后点返回期望回货架] → 顶栏统一回管线任务更符合「管线任务」心智；回货架用明确按钮。
