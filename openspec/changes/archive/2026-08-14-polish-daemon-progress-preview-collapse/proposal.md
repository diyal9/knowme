## Why

Daemon 审阅「过程日志」中 PROGRESS.MD 以源码 `<pre>` 展示，可读性差；PROGRESS.MD / 运行日志区块文件头不可折叠，进度摘要与长日志争抢视口。需要对齐 Daemon WebUI：可折叠分区 + Markdown 预览，并轻微美化。

## What Changes

- PROGRESS.MD、运行日志区块支持点击文件头折叠/展开，状态在同任务重绘时保留
- PROGRESS.MD 默认 Markdown preview（安全渲染），可切换查看源码
- 过程日志分区视觉：更清晰的文件头、预览排版、折叠后日志区获得更多空间

## Capabilities

### New Capabilities

- `daemon-progress-preview`: 过程日志 Tab 内 PROGRESS 预览与分区折叠

### Modified Capabilities

- （无主规格增量以外的既有 capability 重写）

## Impact

- `src/workbench.js`、`src/workbench-layout.css`、`src/workspace.html`（引入 `markdown-lite`）
- 契约测试：`tests/workbench-templates.test.js`
