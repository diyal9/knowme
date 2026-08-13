## Context

`.wb-workflow-manage-flow-step` 现用 `max-width:9.5em` + ellipsis，中文约 9 字的门禁名会被裁切。首页与维护共用该类。See proposal.md — Why。

## Goals / Non-Goals

**Goals:** 卡片宽度内完整显示步骤名；极端超长有 title 兜底。  
**Non-Goals:** 改官方 gate 命名、改产出 chip 截断。

## Decisions

1. **去掉固定 9.5em，改为 `max-width:100%`**  
   长标签占满一行时完整显示；更长才 ellipsis + title。  
   备选：缩短官方 gate 名 — 影响图内命名，范围过大。

2. **`workflowBriefFlowHtml` 为每步加 `title`**  
   与 CSS 兜底一致，悬停可读全文。

## Risks / Trade-offs

- [长标签占满一行，步骤更「高」] → 可接受；比裁切更清晰。
