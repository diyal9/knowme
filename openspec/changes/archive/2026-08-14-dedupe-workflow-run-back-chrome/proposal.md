## Why

工作流运行右栏已有 `#wbRunBack`（「返回」），但工作台顶栏 `#wbReload` 在运行态仍显示为孤立 chevron，形成双返回且上空一条几乎空白的顶栏。用户明确可删上面那个空返回。

## What Changes

- 工作流运行面（非专家任务房）不再在 `.wb-head` 显示返回 chevron。
- 运行面激活且由 `#wbRunBack` 承担退路时，隐藏整条空顶栏 `.wb-head`，避免双层 chrome。
- 编排页与专家任务房仍保留顶栏 `#wbReload` 返回（它们没有 `#wbRunBack`）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workbench-workflow-shelf`：运行顶栏返回唯一性；工作台全局头在工作流运行面的显隐。

## 目标用户

- 从货架启动工作流后，在右栏审阅执行结果、需要一次点返回的知识工作者。

## 验收标准

- 工作流运行面只保留 `#wbRunBack` 一处返回；顶栏不再出现孤立 chevron。
- 运行面不再露出几乎空白的 `.wb-head` 条。
- 编排页、专家任务房顶栏返回仍可用。
- 相关静态契约测试通过。

## 非目标（Non-goals）

- 不改 Run / Daemon 状态机或 `backToRunList` 语义。
- 不重做专家任务房顶栏。
- 不删除底栏「返回流程」次要退路。

## Impact

- `src/workbench.js`、`src/workspace.html`（可选 id）、`src/workbench-console.css` / `workbench-shelf.css`
- `tests/workbench-templates.test.js`（如需契约）
