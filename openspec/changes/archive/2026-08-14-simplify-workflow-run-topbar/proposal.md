## Why

运行顶栏的「确认输入 / 执行中 / 产物」三段步进不可点击，却长得像控件，挤占标题区并制造假可点预期；同时顶栏缺少醒目返回，用户只能翻到右栏底栏「返回流程」。需要把顶栏收成「标题 + 结论 pill + 返回」，贴顶展示。

## What Changes

- 移除运行顶栏装饰性阶段步进条 `#wbRunStepper`（确认输入 / 执行中 / 产物）；阶段仍由下方内容面（表单 / 审阅 / 产物）表达。
- 顶栏保留工作流标题与唯一任务结论 Status Pill（失败 / 执行中 等）。
- 顶栏右侧恢复可点「返回」控件（文案「返回」，绑定 `backToRunList`）；底栏「返回流程」可保留作次要退路。
- 压缩顶栏垂直占位，使标题与返回贴齐运行面顶部。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workbench-workflow-shelf`：运行顶栏结构、阶段指示与返回控件要求。

## 目标用户

- 从货架启动工作流后，在右栏审阅执行结果、需要快速回到货架的知识工作者。

## 验收标准

- 运行顶栏不再出现「确认输入」「执行中」「产物」三段步进文案。
- 顶栏标题旁仍有 Outcome Pill（执行中/失败等终态可读）。
- 顶栏右侧有可点击「返回」，行为与 `backToRunList` / 底栏返回一致。
- 顶栏视觉贴顶、不因步进条挤占身份区；相关静态契约测试通过。

## 非目标（Non-goals）

- 不改 Run / Daemon IPC、状态机或三段内容面结构。
- 不重做左栏过程对话或审阅制品 Tab。
- 不删除底栏操作区（刷新 / 重新执行 / 返回流程）。

## Impact

- 主要改动：`src/workspace.html`、`src/workbench.js`、`src/workbench-shelf.css`、`tests/workbench-templates.test.js`。
- 修订此前 `clarify-workflow-run-status-surface` 中「保留步进、去掉顶栏返回」的决策。
