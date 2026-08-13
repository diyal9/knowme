## Context

右栏「过程日志」Tab 已合并 PROGRESS.MD 与运行日志。当前两者均为静态灰头 + 源码/纯文本，无法折叠。

## Decisions

1. **折叠**：整段 `header` 可点；`aria-expanded`；状态存在会话内存 `daemonLogsPanelCollapsed`，重绘时写回 `is-collapsed`。
2. **预览**：默认用已有 `MarkdownLite.render`（先转义再格式化），不引入 marked；头栏提供「预览 / 源码」切换。
3. **布局**：PROGRESS 折叠后日志块吃满剩余高度；展开时 PROGRESS 仍有适度上限，避免挤死日志。

## Risks

- 重绘签名未变时跳过 innerHTML：折叠仅改 class，不触发全文重绘；视图模式切换需改签名或强制重绘。
