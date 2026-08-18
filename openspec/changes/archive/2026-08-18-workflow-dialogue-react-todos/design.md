## Context

工作流对话房（`openWorkflowDialogueRoom`）已复用专家 Session / task-room；本地 Agent Loop 已具备 `run.plan`、`update_plan`、`plan.updated` 与 `renderPlanChecklist`。缺口在于：工作流会话未强制 ReAct，清单 UI 也不像 Cursor To-dos 那样成为主进度面。Motivation 见 `proposal.md`。

主进程持有 plan SSOT 与工具；Renderer 只消费 `plan.updated` / 消息态渲染，不经 IPC 回写 plan。

## Goals / Non-Goals

**Goals:**

- 带 `workflowId` 的 Session 在多步任务中强制可见 ReAct 计划循环。
- To-dos UI 与 plan SSOT 同源，状态可观测。
- 复用既有 plan gate / budget expansion，不新开编排运行时。

**Non-Goals:**

- 不替换 Runtime（RunManager/Scheduler）为 LLM GroupChat。
- 不强制全部专家对话硬 ReAct。
- 不改变 Artifact 写盘审批模型。

## Decisions

1. **策略开关按 Session 元数据，不按 UI 页面**  
   依据 `session.meta.workflowId`（或等价 task 字段）启用 workflow-ReAct 提示与首轮 plan 要求。  
   *备选*：仅在 workbench task-room 开——易漏助理侧同 Session 恢复。

2. **计划种子：提示强制 + 可选轻量 seed，不伪造完成态**  
   首轮 developer/system 注入 ReAct 指令（思考→计划→执行→验收）；若 workflow 有协作步骤，可 `replace` 种子 pending 项，状态一律未完成。模型仍须 `update_plan` 推进。  
   *备选*：服务端自动把每步标 doing——会假进度。

3. **UI 对齐 Cursor To-dos，协议字段不变**  
   头文案「To-dos {n}」，doing 用实心箭头、pending 虚线圆、done 勾选；仍用 `pending|doing|done|blocked`。  
   *备选*：新事件类型 `todos.updated`——重复协议，拒绝。

4. **验收映射为 plan 末项或 evidence，不新增 lane**  
   ReAct「验收」= plan 中验收项 + 既有 self-verify；不新增 answer lane 阶段。

5. **IPC 边界**  
   主进程：`update_plan` → 改 `session.run.plan` → 发 `plan.updated`。Renderer：reducer 写入 message.plan → `renderPlanChecklist`。无新 IPC channel。

## Risks / Trade-offs

- [模型忽略 update_plan] → 工作流提示强调首工具调用；plan 空则 UI 不假装有 To-dos；门禁仍拦虚假「已完成」。  
- [种子计划与用户目标不符] → 种子仅作骨架，允许 `replace` 整表。  
- [非工作流会话被误伤] → 严格按 workflowId 门控策略。  
- [清单占气泡高度] → 上限仍 12 项；样式紧凑。

## Migration Plan

1. 先改 Renderer To-dos 样式（无行为风险）。  
2. 再注入 workflow ReAct 提示与可选种子。  
3. 回归 `agent-plan-tools` / stream repaint / 工作流对话打开路径。  
4. 回滚：去掉 workflow 提示与样式文案即可，plan 协议不变。

## Open Questions

- 极短澄清问答（单轮确认输入）是否豁免硬 ReAct：实现时可对「无工具且用户仅澄清」跳过种子，但多步交付仍强制。
