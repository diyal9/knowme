## Why

管线审阅「步骤」Tab 的节点进度把类型、执行者、内部产出 kind 与完整制品路径挤进同一行副文案，长路径换行后节奏不齐，扫读成本高，削弱「现在到哪一步」这一核心价值。

## What Changes

- 节点主信息分层：标题 → 类型·执行者 →（可选）短产出名；不再把内部 kind + 全路径拼进同一行。
- 产出仅展示可读短名（优先文件名），完整路径放在 `title` 悬停；无产出的并行/循环节点不留空噪点。
- 步骤列表 CSS 统一单行省略与行距，减少参差换行。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`：步骤时间线节点文案层次与可读性要求。

## 目标用户

- 在管线运行审阅中需要快速扫读「谁在执行 / 产出什么」的知识工作者与开发者。

## 验收标准

- 有产出节点副文案不再同时出现内部 kind（如 `proto_changes_doc`）与完整 `artifacts/...` 路径。
- 类型与执行者仍可见；有产出时可见短文件名（或等价短标签）。
- 长文案在窄栏下单行省略，不把相邻节点顶得高低不一。
- `workbench-task-projection` 相关单测通过。

## 非目标（Non-goals）

- 不改 Daemon / 工作流 JSON 协议或制品 Tab 内容。
- 不重做进度条、时间线圆点状态色或降级空态。
- 不改左栏过程对话。

## Impact

- `src/lib/workbench-task-projection.js`
- `src/workbench.js`（步骤 Tab 渲染）
- `src/workbench-layout.css`
- `tests/workbench-task-projection.test.js`
