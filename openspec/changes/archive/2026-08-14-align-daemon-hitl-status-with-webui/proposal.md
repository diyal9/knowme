## Why

同一管线任务在 Daemon WebUI 显示「待处理 / 0/12 / 需提交答复」，KnowMe 却顶栏「已完成」并强制 ProtoDesigner 12/12，用户无法在 KnowMe 完成 HITL。状态投影与 WebUI 不一致会直接破坏任务闭环与信任。

## What Changes

- 对齐 Daemon WebUI：存在 `pending_clarifications` / `pending_gates`（或等价 HITL）时，任务结论为「等待你 / 待处理」，不得标「已完成」。
- 运行态优先读 `status.state`（过程元数据），不以陈旧 `job.state=completed` 覆盖仍在等待的任务。
- 顶栏 Outcome、进度卡、步骤投影、任务 brief 统一「等待优先于完成」；有澄清时展示 HITL，进度停在当前步。

## Capabilities

### New Capabilities

- `daemon-run-status`：管线任务运行态与 HITL 结论投影（对齐 Daemon WebUI）。

### Modified Capabilities

无。

## 目标用户

- 在 KnowMe 工作台推进 Daemon 管线、需要与官方 WebUI 一致处理澄清/门禁的知识工作者。

## 验收标准

- 任务 `status=idle` + `pending_clarifications` 时：顶栏为「等待你」（或等价待处理），不为「已完成」。
- 进度卡不强制 12/12·100%；当前步保持进行中/待处理语义。
- 左侧出现澄清/门禁 HITL 入口，可提交答复。
- `npm test` / `npm run lint` 通过；单测覆盖 HITL 优先于 completed。

## 非目标（Non-goals）

- 不改 Daemon HTTP API / 服务端状态机。
- 不重做审阅双栏布局或过程日志 Tab 结构。
- 不改 Agent 工具超时策略。

## Impact

- `src/lib/workbench-daemon-client.js`、`workbench-task-lifecycle.js`、`workbench-task-brief.js`、`workbench-daemon-surface.js`、`workbench-daemon-review.js`、`src/workbench.js`
- 测试：`tests/workbench-task-brief.test.js`、`workbench-daemon-client.test.js`、`workbench-task-lifecycle.test.js`、`workbench-daemon-surface.test.js`
