## Context

工作台左栏对话已通过 `workbenchContextText` 注入任务事实与 `workbenchGroundingRules`，但规则偏「别编造角色」，缺少第一性原则与强制引用来源；UI 仅在有 `groundingStatus.sources` 时显示工具来源，任务事实本身不可见。See proposal.md - Why。

## Goals / Non-Goals

**Goals:**
- 强化工作台提示词门禁（事实 + 第一性 + 引用）
- 构建本轮 citation 列表并注入提示词 + 气泡 UI
- 与现有 GroundingUI 工具来源并存、合并展示

**Non-Goals:**
- 不改 OutputGate / EvidenceLedger 内核
- 不强制联网检索

## Decisions

1. **纯函数 citation 构建在 `workbench-task-brief.js`**  
   输入任务上下文 → `{ label, detail?, kind }[]`，渲染与注入共用，易测。

2. **规则扩写而非新 system 底座**  
   继续挂在任务上下文块内，避免污染助手模式 `ASSISTANT_BASE_PROMPT`。

3. **UI：工作台专用 citation details + 保留 grounding meta**  
   新增 `.agent-workbench-citations`；工具来源仍走 GroundingUI。合并逻辑：citation 含任务事实/产物；grounding 含工具。

4. **消息字段 `workbenchCitations`**  
   发送前快照挂到本轮 assistant 消息，避免任务切换后串源。

## Risks / Trade-offs

- [模型仍口头幻觉] → 强化规则 + 要求正文用「依据：…」；UI 至少暴露可用源  
- [来源列表过长] → 上限 8 条，产物路径截断

## Migration Plan

无数据迁移；重启应用即可。回滚：还原 brief 规则与 workspace-agent 渲染。
