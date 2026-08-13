# Change: rename-workbench-tab-copy

## Why

工作台用户可见文案两处易混淆：「货架」是电商隐喻，与顶栏「工作流」Tab 不对齐；顶栏「任务」与「工作流任务 / 管线任务 / 运行任务」等多处泛结果词撞名，弱化了「安排专家协作」主线。

## What Changes

- 用户可见「货架」一律改为按 Tab 命名（主要说「工作流」；退路写「返回工作流」）。
- 顶栏 Tab「任务」改为「专家协作」；`data-wb-mode="tasks"` 等代码标识不变。
- 专家协作页 / 工作流页内文案少用裸「任务」：改为「协作」「运行」等路径词（如「最近协作」「工作流运行」「开始运行」）。
- **非目标**：不重命名 CSS class / surface id（`shelf`、`taskhome`）；不改 IPC / store schema。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `agent-workbench`：三 Tab 文案为「专家协作 / 工作流 / 管线服务」；退路与空态按 Tab 命名。
- `workbench-workflow-shelf`：用户可见「货架」改为「工作流」。

## Impact

- `src/workspace.html`、`src/workbench.js` 用户可见文案
- `tests/workbench-templates.test.js` 断言
- 主规格 delta；历史 change 文档不回溯改写
