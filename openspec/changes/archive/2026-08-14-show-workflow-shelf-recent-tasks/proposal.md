## Why

工作台「工作流」Tab 目前只有货架卡片，货架下方留白；从货架启动的工作流任务虽已写入 `workbench-tasks`（带 `workflowId`），却只能在「任务」Tab 的「最近任务」里回看，与「任务 Tab = 专家快捷 + 最近任务」的信息架构不对称。用户期望在工作流页下方同样看到工作流任务列表，方便就地恢复。

## What Changes

- 「工作流」货架下方新增「工作流任务」区，展示带 `workflowId` 的持久化任务（状态、摘要、相对时间），交互对齐任务 Tab「最近任务」（卡片网格、默认预览条数、「更多/收起」、点击打开）。
- 「任务」Tab「最近任务」仅展示无 `workflowId` 的专家任务，避免工作流任务在两处重复占位。
- 复用现有 task-store / 打开任务逻辑；不改工作流启动、对话房或持久化模型。

验收标准：

- 进入「工作流」Tab，货架下方可见「工作流任务」区。
- 从货架启动过的任务出现在该区；点击可恢复同一 Session / 对话房。
- 无工作流任务时显示空态提示。
- 「任务」Tab 最近任务不再混入带 `workflowId` 的条目。
- 默认预览条数与「更多/收起」行为与任务 Tab 一致。

非目标（Non-goals）：

- 不改任务持久化 schema / IPC。
- 不做按工作流包筛选或独立 workflow-run store。
- 不改货架卡片、管理工作流入口或管线服务 Tab。

## Capabilities

### New Capabilities

- `workbench-workflow-shelf-recent`: 工作流货架下方「工作流任务」列表的展示、折叠与打开行为。

### Modified Capabilities

- `workbench-task-home-recent`: 任务首页「最近任务」仅展示专家任务（无 `workflowId`）。

## Impact

- `src/workspace.html`：货架下方新增工作流任务面板 DOM
- `src/workbench.js`：按 `workflowId` 分流渲染；货架刷新时同步工作流任务区
- `src/workbench-layout.css`：货架页纵向布局与任务区样式
- 可选轻量测试断言分流与空态
