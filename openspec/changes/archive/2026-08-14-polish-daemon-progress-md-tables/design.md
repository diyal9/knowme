## Context

See proposal.md — Why。`MarkdownLite.render` 用于 `.wb-daemon-progress-md`；当前只支持标题/列表/代码/段落，管道表被当成 `<p>`。

## Goals / Non-Goals

**Goals:**

- 正确解析 GFM 管道表为 `<table>`。
- 过程区表格可读、可横滑。

**Non-Goals:**

- 不全量 Markdown 兼容；不支持 HTML 单元格。
- 不改 progress 文本来源。

## Decisions

1. **在 markdown-lite 内解析表格**  
   与流式缓冲（`agent-stream-visibility` 已等表闭合）一致；避免引入 marked。

2. **识别规则**  
   表头行 + 分隔行（`---` / `:---` / `---:`）+ 0..n 数据行；无分隔行则不当作表。

3. **输出**  
   `<div class="md-table-wrap"><table class="md-table">…` 便于横滑与样式挂钩。

## Risks / Trade-offs

- [Risk] 假阳性：普通以 `|` 开头的段落 → Mitigation：必须紧跟分隔行才成表。
- [Risk] 宽表撑破面板 → Mitigation：wrap + overflow-x:auto。
