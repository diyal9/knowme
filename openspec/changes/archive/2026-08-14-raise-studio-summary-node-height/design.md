## Context

摘要卡曾为「相对内联表单更矮」做了压缩；`sizeForNode` 对 `mode-text` 只预留约 28px，而 CSS 目标框实际约 3 行 + padding ≈ 50px+，再叠加 `.wb-studio-flow-sections { overflow:hidden }`，底边与目标框被裁切。

## Goals / Non-Goals

**Goals**

- 高度预算与 CSS 可见行数对齐
- 目标多显示约 1 行，底边留白完整

**Non-Goals**

- 不改 sections 投影字段集合
- 不引入画布滚动条到单卡内部

## Decisions

1. **抬高 text 分区预算**：`sizeForNode` 中 `mode-text` 由 ~28 提到 ~56，分区 chrome/底部 padding 略增。
2. **CSS line-clamp: 4**：与预算对齐；短文案仍靠 min-height 保持可读块。
3. **略抬 agent 地板高度**：避免仅一行专家时仍偏扁。
4. **保留 MAX_NODE_H**：不放开上限，避免超长 Prompt 撑爆画布。

## Risks / Trade-offs

- 画布更「高」可能增加纵向滚动 → 可接受，可读性优先。
- 已保存的坐标布局不变，仅节点变高可能轻微叠边 → 用户拖一下或点自动布局即可。
