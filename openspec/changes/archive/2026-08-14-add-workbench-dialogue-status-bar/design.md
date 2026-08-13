## Context

See proposal.md — Why。现状：工作台模式默认 `display:none` 隐藏 `.agent-col-head`；task-room 虽显示左对话列，但无身份顶栏，「当前工作」仅存在于空态文案。右栏专家任务房 `wb-expert-task-head` 只有状态点；Daemon/工作流运行有 `#wbRunBack` 顶栏但不与左列对齐。改动仅在渲染进程（HTML/CSS/JS），无新 IPC。

## Goals / Non-Goals

**Goals:**

- 为 task-room 左对话列增加轻量状态栏 DOM，并按专家 / 工作流 / Daemon 投影标题与返回。
- 右栏顶栏与左栏同构（标题 + 操作），消除「无头对话」。
- 保持现有返回语义与双返回防冲突逻辑（`syncHeadActionButton`）。

**Non-Goals:**

- 不实现图二次级 Tab / 发布留言条。
- 不改主进程、Daemon API、Session 存储结构。
- 不重做助理模式顶栏。

## Decisions

1. **左栏独立 chrome，不复用助理 `agent-col-head` 全套**  
   助理顶栏含 Session Tab / 历史 / 更多；工作台 task-room 需要的是「身份 + 返回」。新增 `#agentDialogueStatusBar`（或等价）挂在 `agent-col` 顶部，仅在 `data-workbench-layout="task-room"` 显示。  
   *备选*：复用 `agent-col-head` 并改内容 → 易与助理模式耦合，放弃。

2. **标题投影优先级**  
   - 专家协作：`task.goal` → 专家名 →「专家协作」  
   - 工作流对话：工作流短名 → `task.goal` →「工作流」  
   - Daemon：复用 `daemonRunIdentityTitle()` / `#wbStartTitle` 同源文案  
   由 `workbench.js` 在进入/刷新 task-room 时调用 `syncDialogueStatusBar()`，必要时经现有 bridge 通知 `workspace-agent` 无需改协议。

3. **返回按钮**  
   左栏返回绑定与现有任务房返回同一路径（`wbReload` 作返回时的 handler / `leaveExpertTaskRoom` / `backToRunList`）。Daemon 运行面仍以右栏 `#wbRunBack` 为主退路时，左栏返回调用同一函数，避免两套逻辑。全局 `#wbHead` 在纯 run 面继续可隐藏，避免三返回。

4. **右栏专家任务房**  
   扩展 `wb-expert-task-head`：左标题 + 可选状态 pill，右保留协作状态点或次要操作；不把返回只藏在全局头。

5. **样式**  
   对齐 `.wb-run-topbar` 的贴顶、单行、左标题右操作；高度压缩，避免挤占对话首屏。仅渲染层，对启动性能无实质影响。

## Risks / Trade-offs

- [双返回] 左栏与右栏都有返回 → Mitigation：同一 handler；纯 run 面隐藏全局头；文案统一「返回」。
- [标题过长溢出] → Mitigation：`text-overflow: ellipsis`；窄窗单行不换行。
- [空态「当前工作」与顶栏重复] → Mitigation：空态可保留引导，身份以顶栏为准；可选弱化 kicker，不强制删引导块。

## Migration Plan

无数据迁移。回滚即恢复隐藏左栏 chrome 与专家头旧结构。

## Open Questions

无（图二次级 Tab 明确延期）。
