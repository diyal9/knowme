## Context

基线：`f6ad048` `src/workbench.js` 的 `openOrchestration` / `ensureStudioDraft` / `handleWorkflowManageAction` / `forkWorkflowPackage` / `leaveStudioToShelf`。

## Goals / Non-Goals

**Goals:** 渲染层进出编排与基线一致。  
**Non-Goals:** 重写 Studio 画布引擎。

## Decisions

1. `enterStudio(from, workflowId?)`：无 id 即 `reset`；有 id 则 `fromGraph(shelf graph || GET || list)`。
2. `studioReturnSurface` + `studioReturnManagePanel` 记录来源；默认返回 `manage` + `workflows`。
3. fork IPC 传入 `{ name, package }`，与基线 `workbench-workflow-package-fork` 一致。
4. 离开确认增加「保存后离开」第三动作。

## Electron 边界

打开草稿只读 `window.api`；graph 已在 `workbench-load` 下发，渲染层不再把 GET 当唯一来源。

## Risks

| Risk | Mitigation |
|------|------------|
| GET 与货架 graph 不一致 | 优先 GET，失败回退货架 graph |
| 返回落到管线服务 | 离开时显式写回 `managePanel: workflows` |
