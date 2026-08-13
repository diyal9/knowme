## Why

工作流对话房已能打开双栏 Session，但执行过程仍像「普通聊天」：用户看不到 Cursor 式 To-dos 进度，模型也未强制走 ReAct（思考→计划→执行→验收）。结果是工作流多步协作缺乏可观测性与可验收闭环，货架转化后的信任感不足。

### 目标用户

- 从工作流货架进入对话、需要跟进多步交付的知识工作者。
- 希望一眼看到「现在做到哪一步、还剩什么、是否验收」的专业用户。

### 商业化与体验价值

工作流是工作台高价值入口；可见 TO-DO + ReAct 把「黑盒生成」变成「可跟进协作」，提升完成率与复购意愿，并与既有 `update_plan` / plan checklist 基建对齐，边际成本低。

## What Changes

- 工作流对话（带 `workflowId` 的 task-room Session）MUST 采用 ReAct 运行模式：先思考与澄清目标，再用结构化计划推进，执行中更新状态，收尾做验收/证据，禁止跳过计划直接宣称完成。
- 对话气泡中强化 Cursor 风格 **To-dos** 清单：标题含项数、进行中/待办/完成/阻塞状态可视化；与 `plan.updated` / `update_plan` 同源。
- 首轮或首条用户目标后，系统 SHOULD 引导或种子生成含「思考/计划/执行/验收」语义的计划项（可映射工作流协作步骤），并在运行中持续 `update_plan`。
- 计划未完成时沿用既有预算扩展与 partial finalize 门禁，不提前宣称完成。
- UI 文案由「计划 · 剩余 N」对齐为「To-dos N」风格（可保留剩余提示），不改变协议字段名。

## Capabilities

### New Capabilities

- `workflow-dialogue-react`: 工作流对话房的 ReAct 行为契约与可见 TO-DO 体验。

### Modified Capabilities

- `agent-run-plan`: 工作流对话 Run MUST 启用并推进结构化 plan；ReAct 阶段与验收门禁可映射到 plan items。
- `agent-chat-ux`: 计划清单渲染对齐 To-dos 视觉与可访问性（工作流对话优先，专家对话可复用同一组件）。
- `workspace`: 工作流 task-room 声明 ReAct 运行模式与计划可见性要求。

## Impact

- 主进程：工作流 Session 的 system/developer 提示、plan 工具启用策略、首轮 plan 种子（`main.js` / agent loop / context orchestrator）。
- 渲染：`workspace-agent.js` `renderPlanChecklist`、`workspace.html` To-dos 样式。
- 复用：`agent-plan-tools`、`agent-run` plan SSOT、`plan.updated` 事件。
- 测试：plan 渲染/种子、工作流对话冒烟、既有 `agent-plan-tools` / stream repaint 回归。

### 验收标准

- 从货架进入工作流对话并发起多步任务后，气泡内出现 To-dos 清单（项数 ≥3，含进行中与待办态）。
- 执行过程中 To-dos 状态随 `update_plan` 更新；完成前可见验收相关项或证据。
- 计划未完成时不得以「全部完成」口吻终态收束（与现有 plan gate 一致）。
- 自动化测试与 lint 通过；Electron 冒烟无新增控制台错误。

### 非目标（Non-goals）

- 不新建独立 Orchestrator 聊天或替换 Runtime 调度。
- 不引入 AutoGen 式 GroupChat 作为产品编排层。
- 不强制所有非工作流专家对话都走硬 ReAct（可复用 UI，策略仅对 workflow 会话强制）。
- 不重做 Agent Graph Studio / Daemon 跑批主路径。
