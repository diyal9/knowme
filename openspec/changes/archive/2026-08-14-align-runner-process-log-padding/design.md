## Context

见 `proposal.md`。遗留 runner 结构为：

```
.wb-runner
  .wb-task-context          /* padding: 14px */
    .wb-run-section…        /* 当前状态 / 追溯 / 目标 / 专家 / 节点 / 产物 */
  .wb-runner-log-section    /* 无水平 padding → 过程日志贴左 */
  .wb-runner-actions
```

过程日志刻意放在滚动区外作底部固定区；对齐只需补边距，不必迁入 `wb-task-context`。

## Goals / Non-Goals

**Goals:**

- 过程日志标题/内容与上方分区左缘一致（14px）。
- 日志块改为 inset，避免全宽贴边条。

**Non-Goals:**

- 不改 DOM 父子关系或 Daemon 审阅 Tab。
- 不改 JS 渲染逻辑。

## Decisions

1. **CSS 补齐 padding，不搬 DOM**  
   - 备选：把 log section 移入 `wb-task-context` → 会随内容滚动，违背「底部常驻」意图。  
   - 采用：`.wb-runner-log-section { padding: 10px 14px 12px; background: #fbfaf7; }` 对齐 task-context。

2. **日志内容改为 inset 卡片**  
   - `.wb-runner-log` 使用 `border` + `border-radius: 8px`，去掉仅 `border-top` 的全宽 footer 观感。

3. **渲染边界**  
   - 仅改 `workbench-layout.css` / `workbench-console.css`；主进程/IPC 无变更。

## Risks / Trade-offs

- [Risk] console 覆盖层冲掉 layout 规则 → Mitigation：同步更新 `workbench-console.css` 中 `.wb-runner-log` 背景规则，必要时提高选择器一致性。
