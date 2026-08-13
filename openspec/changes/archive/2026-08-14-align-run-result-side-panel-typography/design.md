## Context

对话右栏 `.wb-side-workflow` 已形成稳定排版：`panel-head` 小标题（650 / 11.5px / `--wb-text`）、主标题（680 / 16px）、区块 `padding/margin 12px` + `border-bottom: 1px solid var(--wb-border)`。结束态 `#wbRunStageResult` 已有堆叠标题与「产物」分区，但颜色、分割线与内边距未复用同一节奏。

## Goals / Non-Goals

**Goals:**
- 结果页视觉 token 与右栏工作流卡对齐（字号、字重、颜色、分割线、边距）。

**Non-Goals:**
- 不改数据结构或产物交互。

## Decisions

1. **结构**：标题头（+ 可选执行结果摘要）包在 `.wb-run-result-block`，底部划线；其下为产物 section。
2. **分区标题**：`.wb-run-result-section-title` 使用与 `.wb-side-panel-head strong` 相同的 `--wb-text` + `650 11.5px`，不再用 muted。
3. **边距**：结果 stage-inner 水平 padding 提到 `11px 12px`，对齐 `.wb-side-panel`。
4. **分割线 token**：统一 `var(--wb-border, #e2ded5)`，含 footer `border-top`。

## Risks / Trade-offs

- [Risk] 摘要仍为卡片时与 intro 文风略异 → Mitigation：摘要放在标题块内、分割线之上，不改变摘要框本身。

## Migration Plan

热更 JS/CSS；回滚删除 block 类与 CSS 即可。
