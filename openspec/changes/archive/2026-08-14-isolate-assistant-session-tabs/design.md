## Context

See proposal.md — Why。当前 `surfaceUi.v2` 已分 `agent` / `workbench` 两套 `openIds`，但 `applyWorkbench` 对 `expert-chat` / `workflow-chat` 强制落到 `agent`，且 `startExpertChat` 一律切到助理 surface，导致工作台 Session 写入助理 Tab。渲染进程本地 `localStorage` 持有 surfaceUi；主进程 `agentSessionSetUi` 只持久化当前打开集合，不区分 surface。

## Goals / Non-Goals

**Goals:**

- 助理 Tab 只反映 `agent` surface 的打开集合。
- 工作台内创建/恢复的专家、工作流、Daemon 协作 Session 只写入 `workbench` surface。
- 一次性迁移已污染的助理 Tab，无需用户手动清理。

**Non-Goals:**

- 不改主进程 Session 存储 schema（可不新增字段，靠 taskRef / goal 启发式分类）。
- 不隐藏工作台 task-room 内的 Tab chrome（若仍显示，仅展示 workbench 集合）。

## Decisions

1. **Surface 选择简化**  
   `workbenchOn === true` → 始终 `setSurfaceMode('workbench')`；离开工作台 → `agent`。  
   不再把 expert/workflow chat 特例挂到 agent。  
   *备选*：为对话房新增第三 surface — 过重，否决。

2. **工作台开工路径**  
   `startExpertTaskChat` / `resumeExpertTaskChat` 在创建或激活前切到 workbench surface；`startExpertChat` 增加 `surface: 'workbench' | 'agent'`（默认 agent，能力面不变）。  
   *备选*：复制一套 startWorkbenchExpertChat — 重复逻辑更多。

3. **归属判定（迁移）**  
   Session 视为工作台归属若：`taskRef.kind === 'workbench-task'`，或 `run.goal` / `displayTitle` 以 `工作台 ·` 开头，或等于工作台默认 goal「当前工作」。加载时从 `agent.openIds` 挪到 `workbench.openIds`。  
   误伤风险：用户在助理里手写同名 goal — 极少；可接受。

4. **切换时激活**  
   `setSurfaceMode` 对 agent 与 workbench 都调用 `activateSurfaceSession`，保证切回助理立即只渲染助理 Tabs。异步不阻塞 UI；以 `surfaceSwitchNonce` 防竞态（已有）。

## Risks / Trade-offs

- [历史助理专家对话被误迁] → 仅迁移带 workbench 信号的 Session；能力面开工无 taskRef/工作台 goal 前缀，保留在助理。  
- [工作台 task-room 仍见多 Tab] → 符合「隔离助理」目标；若后续要隐藏，另开 change。  
- [全局 `agentSessionSetUi` 仍写当前 surface 打开集] → 与现网一致；surfaceUi 为权威分面来源。

## Migration Plan

1. 发版后首次 `loadSessions` 执行分面清洗并写回 `surfaceUi.v2`。  
2. 回滚：恢复旧 `applyWorkbench` 特例即可；已迁移的 openIds 仍合法。
