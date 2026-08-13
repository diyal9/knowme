## Why

Daemon 任务卡在 Gate / 澄清（need_input）时，人机交互走右栏底栏「回答」按钮 + 弹窗，与左栏对话割裂；用户要在对话记录里看到提问、并在对话中输入或确认。

## What Changes

- 将 Daemon Gate（通过 / 修订 / 打回）与澄清提问投影到左栏对话流，作为可交互卡片。
- 澄清：用户在对话输入框直接回复并发送，提交后任务继续；不再弹出「补充任务信息」模态框。
- Gate：在对话卡片内点选通过 / 修订 / 打回。
- 移除右栏底栏绿色「回答」按钮；无其他必要动作时隐藏 `#wbRunnerActions`。
- 更新任务事实摘要文案：引导在对话区完成审批/澄清，而非「右侧流程操作区」。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：Daemon HITL（Gate / 澄清）MUST 出现在左栏对话流；MUST NOT 依赖底栏「回答」或澄清弹窗作为主路径。

## 目标用户

- 在工作台运行 Daemon 管线、遇到需确认或补充信息卡点的知识工作者。

## 验收标准

- need_input / 澄清时，左栏对话出现提问卡片；底栏无「回答」按钮；无「补充任务信息」弹窗。
- 在输入框回复并发送后，澄清提交成功，任务继续执行。
- Gate 等待时，对话卡片提供通过 / 修订 / 打回；提交后任务继续。
- 相关静态契约与单测通过。

## 非目标（Non-goals）

- 不改 Daemon HTTP 澄清 / Gate API 契约。
- 不改本地 Agent Graph 审批 UI（仅 Daemon 运行面）。
- 不重做过程日志 Tab 或审阅右栏布局。

## Impact

- `src/workbench.js`、`src/workspace-agent.js`、`src/lib/workbench-task-brief.js`
- 样式（对话 HITL 卡）
- `tests/workbench-task-brief.test.js`、`tests/workbench-templates.test.js`（如有契约断言）
