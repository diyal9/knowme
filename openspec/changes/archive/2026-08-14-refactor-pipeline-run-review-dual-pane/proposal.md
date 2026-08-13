## Why

管线任务执行间当前右栏是「状态 / 追溯 / 目标 / 节点」堆叠，左栏对话又拿不到 Daemon 真过程（progress.md / 运行日志），用户对照外部 Daemon WebUI（过程列 + 审阅列）时认知断裂。需对齐 **左过程对话 + 右审阅制品**。

## What Changes

- **左栏（对话框壳）**：管线 run 进行中时，对话流以上载入 Daemon `progress` + `logs` 过程内容（对齐 WebUI process 面板语义），用户仍可补充要求/材料。
- **右栏**：重构为「审阅 制品」面，Tab：**步骤（推荐）/ 制品 / 变更 / 事件**，对齐 Daemon WebUI review panel。
- **数据**：经既有 Daemon HTTP 客户端扩展消费 `/progress`、`/logs`、`/events`、`/changes` 与已有 `/artifacts`。
- **不目标**：不 fork WebUI 全量 JS；不引入 EventSource 流式日志 v1（轮询即可）；不改顶栏本机专家任务。

## Capabilities

### New Capabilities

- `pipeline-run-review-surface`：管线执行间右栏审阅制品与左栏过程对话投影。

### Modified Capabilities

- `agent-workbench`：Daemon 任务执行间布局与审阅优先级约束。

## Impact

- `src/lib/workbench-daemon-client.js`、`src/lib/workbench-daemon-review.js`（新）
- `src/main.js` / `src/preload.js` IPC
- `src/workbench.js` / `src/workspace.html` / CSS / `workspace-agent.js`
- 单测 `tests/workbench-daemon-review.test.js`
