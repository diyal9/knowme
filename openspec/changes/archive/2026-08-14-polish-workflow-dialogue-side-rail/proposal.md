## Why

工作流对话房顶栏状态仍显示「协作中」，与「工作流对话」心智不符；右栏简介 / 需要 / 产出 / 步骤挤成一片，需要与产出用胶囊而非清单，且底部「开始运行」与对话主路径重复，易被当成必点 CTA。

### 目标用户

- 从货架进入工作流对话、靠左侧对话推进任务的知识工作者。

### 商业化与体验价值

对话房是货架主转化路径；清晰右栏说明与贴切状态文案降低「我该点哪」的犹豫，去掉误导主按钮，让用户直接对话完成协作。

## What Changes

- 工作流对话顶栏状态由「协作中」改为「对话中」（专家任务房可保留「协作中」）。
- 右栏工作流信息分段更清晰（横线/区块分割）；「需要」「产出」一律用清单展示。
- 移除右栏「开始运行」按钮及相关「再开始运行」提示；正式跑批不作为对话房次要 CTA。

## Capabilities

### New Capabilities

- `workbench-dialogue-chrome`: 工作流对话顶栏状态标签语义（主库若已有则作增量）。

### Modified Capabilities

- `workbench-workflow-shelf`: 工作流对话房右栏清单展示、去掉次要跑批按钮。

## Impact

- Renderer：`src/workbench.js`、`src/workbench-layout.css`、必要时 `src/workspace.html`。
- 测试：`tests/workbench-templates.test.js` 静态契约。
- 不改 Session / Run / Daemon IPC。

### 验收标准

- 工作流对话顶栏状态为「对话中」，不再显示「协作中」。
- 右栏需要 / 产出为清单；段落之间有清晰分割。
- 右栏无「开始运行」按钮。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不删除货架 play 进入对话房入口。
- 不重做确认输入表单或 Daemon 审阅壳。
- 不改专家任务房以外的运行状态 pill。
