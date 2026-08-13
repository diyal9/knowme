## Context

`polish-daemon-progress-preview-collapse` 已提供折叠与 Markdown 预览，但 UI 仍暴露源码切换与「展开/收起」文字，且标题为文件名。

## Goals / Non-Goals

**Goals:**

- 过程区只渲染 Markdown 预览
- 折叠控件图标化；「过程」默认展开
- 折叠条贴边：过程收起靠顶，运行日志收起靠底

**Non-Goals:**

- 不改左侧对话过程卡（workspace-agent）文案交互
- 不改 SSE / progress 数据契约

## Decisions

1. 删除 `daemonProgressViewMode` 与 `[data-progress-view]` 控件；正文恒走 `MarkdownLite.render`。
2. 去掉 `.wb-daemon-review-logs-fold` 文字；toggle 用 `aria-label` 表达展开/收起。
3. `projectProcessTranscript` 的 `progress.title` 改为「过程」。
4. Flex：`.is-collapsed` 为 `flex: 0 0 auto`；非折叠块 `flex: 1 1 auto`，使收起条贴边、展开区吃满剩余空间。

## Risks / Trade-offs

- 无法再看 raw progress 源码 → 可接受；需要时可从制品目录打开文件。
