## Context

货架/管理卡 IO 条当前 `min-height:30px; padding:6px 10px`，视觉厚于同卡简要流程步骤（`padding:3px 8px`）与编排编辑界面摘要行。纯 CSS。

## Goals / Non-Goals

**Goals:** 压矮货架与管理卡输入/产出背景条，对齐编辑界面紧凑节奏。

**Non-Goals:** 不改文案、布局结构、简要流程步骤。

## Decisions

1. **度量**：去掉 `min-height:30px`；垂直 padding 改为 `3px 8px`（与简要流程步骤条同级）；字号保持 `11.5px/1.3`；条间距 `gap:4px`。
2. **范围**：同时改 `.wb-shelf-chip` 与 `.wb-workflow-manage-chip`，保持首页与管理页一致。
3. **边界**：仅 `workbench-shelf.css`；无 JS / IPC。

## Risks / Trade-offs

- [过矮导致点击热区变小] → IO 条非主交互控件（整卡可点），可接受。
