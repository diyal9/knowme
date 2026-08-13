## Context

`#km-fab-panel` 底部 `.km-fab-actions` 现为两列纵向「图标+标签」按钮（约 72px 宽、多行高）。主操作已是「恢复这个 Session」，日志入口应为次级工具。

## Goals / Non-Goals

- Goals：压缩底栏 chrome；图标可点；tooltip + aria 保留语义。
- Non-Goals：不改面板宽度、resume 卡、IPC。

## Decisions

1. **仅图标**：移除 `.km-fab-action-label` 节点；依赖已有 `title` / `aria-label`。
2. **尺寸**：约 32×32 热区，圆角 8px，图标 ~18px；与面板次级控件比例一致。
3. **布局**：底栏右对齐横向排列（`justify-content: flex-end`），gap 4–6px，避免两枚大卡居中抢眼。

## Risks / Trade-offs

- 无文案时新手可能不立刻理解图标 → 用清晰 tooltip 缓解（已有「日志中心 · 运行/LLM/MCP」「日志目录」）。

## Migration

无数据迁移。
