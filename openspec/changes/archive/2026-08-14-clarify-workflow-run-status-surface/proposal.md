## Why

工作流运行视图里，顶栏「执行中」阶段与卡内「执行失败」任务结论同屏对立，用户无法分清「阶段」和「结果」。同时顶栏「返回货架」与底栏「返回流程」重复，挤占身份区，削弱 DAG 执行时的状态可读性。

## What Changes

- 移除运行顶栏「返回货架」按钮；退出货架改走底栏「返回流程 / 返回工作台」与货架上进行中入口。
- 顶栏新增唯一 **任务结论 Status Pill**（L1）：排队 / 执行中 / 等待你 / 已完成 / 失败 / 已取消。
- 顶栏三段步进保留为 **阶段（L0）**，禁止用其表达失败/成功结论。
- 右栏 `meta` 与步骤 Tab 摘要只承载 **节点进度（L2）**（当前节点 · n/total），不再复制全局结论文案。
- 左栏过程流继续只承载日志与系统说明（L3），不写第二份全局状态色。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workbench-workflow-shelf`：运行视图顶栏结构、状态分层展示与回货架退路的呈现要求。

## 目标用户

- 从货架启动工作流、需要在 DAG 执行中看懂「现在到哪一步 / 是否失败」的知识工作者。

## 验收标准

- 运行顶栏不出现「返回货架」文案或 chevron 按钮。
- 执行中 / 失败 / 完成时，标题旁有且仅有一处 Outcome Pill 表达结论色与短标签。
- 步进条「执行中」与 Pill「失败」可同屏，用户能区分阶段与结论。
- 右栏副标题不为「执行失败」这类结论句，而为节点/进度摘要。
- 底栏「返回流程」仍可回到货架且不中断已登记的运行语义；相关静态契约测试通过。

## 非目标（Non-goals）

- 不改 Run / Daemon IPC、状态机协议或后端选择。
- 不重做专家任务双栏对话房。
- 不重做确认输入表单与产物页结构。

## Impact

- 主要改动：`src/workspace.html`、`src/workbench.js`、`src/workbench-shelf.css`（必要时 `workbench-console.css`）。
- 证据：`tests/workbench-templates.test.js` 与 change 内 dev-self-test；历史 smoke 中对 `#wbTaskBackToList` 的点击需改为底栏返回。
