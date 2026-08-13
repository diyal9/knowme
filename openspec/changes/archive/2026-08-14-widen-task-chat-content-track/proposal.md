## Why

工作台任务对话（专家/工作流 task-room）左栏已被右栏流程区压缩，却仍套用助理全宽页的 980px 居中轨道与更窄的阅读轨，导致消息与输入框两侧留白过大、可用宽度浪费。用户反馈对话记录应再往两边铺开一些。

## What Changes

- 在工作台 `task-room` 下取消对话列的 980px 居中限宽，让消息流与 Composer 铺满左栏（保留适度内边距）。
- 同步放宽该场景下的 `--agent-message-track` / `--agent-reading-track`，使正文、执行过程条与输入框对齐占满可用宽度。
- 助理全宽首页（无文档）的居中阅读轨道保持不变，避免长行回退。
- 补充静态契约测试与开发自测证据。

### 目标用户

- 在工作台任务间阅读多轮对话、对照右侧流程推进工作的知识工作者。

### 验收标准

- 宽窗口进入 workflow/expert 任务对话后，消息与输入框明显贴近左栏两侧，不再出现大块居中留白。
- 「执行过程」条、助手正文、用户气泡与 Composer 水平对齐一致。
- 助理模式（无工作台任务间）长回答仍保持可读的居中轨道，无回归。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不改消息数据结构、流式渲染、Session 或 Daemon 协议。
- 不重做右侧流程面板宽度策略。
- 不调整 Markdown 字号或结构化选择组件视觉以外的行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `agent-chat-ux`: 工作台 task-room 对话列使用铺满侧栏的内容轨道，而非助理全宽页的居中窄轨。

## Impact

- 样式：`src/workbench-layout.css`（主）、必要时微调 `src/workspace.html` 变量。
- 测试：`tests/workspace-agent.test.js` 等静态契约。
- 无 API / 依赖变更。
