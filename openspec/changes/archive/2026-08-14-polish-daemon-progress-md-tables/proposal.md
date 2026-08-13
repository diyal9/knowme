## Why

管线「过程」摘要里的 Steps 是标准 Markdown 表格，但 `MarkdownLite` 不解析 GFM table，整表被拆成带 `|` 的段落，可读性差，审阅体验廉价。

### 目标用户

在工作台查看 Daemon/管线运行「过程」与过程日志的用户。

### 商业化与体验价值

过程摘要是排障与进度感知的主表面；表格化 Steps 让状态一眼可读，降低「半成品渲染」观感。

## What Changes

- `MarkdownLite` 支持 GFM 管道表格（含对齐分隔行）。
- `.wb-daemon-progress-md`（及对话 `.agent-md` 已有表样式）补齐/对齐过程区表格视觉：表头、分隔、横向滚动、状态码样式。
- 单测覆盖 Steps 样例表格渲染。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `pipeline-run-review-surface`（若主 spec 存在则 delta；否则以实现+测试为准）：过程 Markdown 中的 Steps 表 MUST 渲染为 HTML table。

## Impact

- `src/lib/markdown-lite.js`
- `src/workbench-layout.css`
- `tests/markdown-lite.test.js`
- 可选：`tests/workbench-templates.test.js` 静态断言

### 验收标准

- 过程区 Steps 显示为结构化表格（非 `|` 纯文本行）。
- 宽表可横向滚动，不撑破日志面板。
- 对话气泡内同类 Markdown 表一并受益。
- `npm test` / `npm run lint` 通过。

### 非目标（Non-goals）

- 不引入 marked/DOMPurify 全量引擎。
- 不改 Daemon 上游 progress 文案生成。
- 不重做过程日志 Tab 布局。
