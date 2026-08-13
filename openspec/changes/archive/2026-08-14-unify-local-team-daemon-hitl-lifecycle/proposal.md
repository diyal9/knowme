## Why

KnowMe 同时支持 **local-team Agent Graph**（RunManager → Scheduler → Executor）与 **Daemon/Pipeline**（独立 HTTP 作业、SSE、Gate/clarify）两条执行轨。近期 `move-daemon-hitl-into-chat` 已将 Gate/澄清迁入左栏对话，但取消、恢复与观测语义仍未对齐：Daemon 侧 `POST /api/tasks/{slug}/cancel` 未封装，管线任务房间无「停止」入口；列表/顶栏/节点 meta 各自映射状态文案，local 与 daemon 对用户可见结论不一致。

## What Changes

- 新增 **统一运行生命周期投影层**（`workbench-task-lifecycle` 扩展）：双轨共用 `kind` / `outcomeLabel` / `compactLabel` / `hitlKind` / `cancellable`。
- **Daemon cancel**：`workbench-daemon-client.cancel` + IPC + preload + 任务房间「停止」按钮，行为对齐 local `agentRunCancel`。
- **HITL 对齐**：Gate/clarify 与 local gate 均投影为 `waitingKind=gate|clarification`，顶栏 outcome「等待你」优先于完成。
- **观测**：Daemon 列表/审阅面与 Agent Graph 节点 meta 改用统一 compact 文案。

## Capabilities

### New Capabilities

- `unified-run-lifecycle`：local-team 与 Daemon 双轨的运行态、HITL、取消与展示文案投影。

### Modified Capabilities

- `pipeline-run-review-surface`：管线任务房间增加停止动作与 cancel 后状态刷新。

## 目标用户

在 KnowMe 工作台推进官方多 Agent 工作流（local-team 或 Daemon）的知识工作者。

## 验收标准

- 进行中的 Daemon 任务可点「停止」，调用 cancel API 后顶栏变为「已取消」，轮询/SSE 停止。
- local Agent Graph 与 Daemon 在 Gate/clarify 等待时顶栏均为「等待你」，brief `waitingKind` 一致。
- 任务列表/节点 meta 使用统一 compact 文案（待处理/待确认/澄清/进行中/完成/失败/已取消）。
- `npm test` / `npm run lint` 通过；单测覆盖 cancel 封装与统一投影。

## 非目标（Non-goals）

- 不改 Daemon 服务端状态机或新增 resume/chat SSE 封装（后续 change）。
- 不重做审阅双栏布局或 HITL 卡片 UI。
- 不统一 RunManager 与 Daemon 的底层事件总线。

## Impact

- `src/lib/workbench-task-lifecycle.js`、`workbench-daemon-client.js`、`workbench-daemon-surface.js`
- `src/ipc/workbench-daemon.js`、`src/preload.js`、`src/workbench.js`
- 测试：`tests/workbench-task-lifecycle.test.js`、`tests/workbench-daemon-client.test.js`
