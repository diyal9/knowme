## Context

Daemon 运行双栏：左栏协作对话，右栏审阅。澄清目前走 `daemon-clarify` → 模态 `clarify`；Gate 走右栏底栏按钮。过程日志已迁入右栏 Tab，左栏应专注对话与人机交互。

## Goals / Non-Goals

**Goals**：

- Gate / 澄清以对话卡片呈现。
- 澄清用 Composer 发送提交；Gate 用卡片内按钮。
- 去掉「回答」按钮与澄清弹窗主路径。

**Non-Goals**：

- 不改 Daemon API。
- 不改 Agent Graph 审批。
- 不恢复左栏过程日志卡。

## Decisions

1. **HITL 卡由 `WorkspaceAgent` 根据 `workbenchTaskContext.waitingKind` 同步**  
   `updateWorkbenchTaskContext` / `enterWorkbenchTask` 时 upsert 一条 `role: 'daemon-hitl'` 消息（按 slug+node 去重）；等待解除后标记 `resolved` 或移除交互区。

2. **澄清发送拦截**  
   `waitingKind === 'clarification'` 时，发送不走 `aiGenerate`，改为 `workbenchDaemonClarify`；成功后 refresh 由 workbench 轮询/回调完成。通过自定义事件或 `opts.onDaemonClarify` 桥接，避免 agent 直接依赖 workbench 内部。

3. **Gate 点击**  
   对话卡 `data-daemon-hitl="approve|revise|reject"` → 回调 `workbenchDaemonGate`。

4. **底栏**  
   `renderDaemonRunner` 不再渲染 `daemon-clarify`；Gate 按钮也从底栏移除（迁入对话）。`#wbRunnerActions` 在无动作时保持 hidden。

5. **文案**  
   `workbench-task-brief` 的 nextAction / waitingDetail 改为引导对话区。

## Risks / Trade-offs

- [用户想与助手闲聊而非提交澄清] → 澄清等待期间发送一律视为回答；卡片注明「发送即提交并继续任务」。等待解除后恢复普通对话。
- [轮询重复插入卡片] → 按 `slug|kind|node` 稳定 key upsert。

## Migration Plan

无数据迁移。旧「回答」入口与 clarify 模态代码路径删除或保留为死代码清理。

## Open Questions

无。
