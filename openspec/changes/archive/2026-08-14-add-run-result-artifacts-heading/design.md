## Context

结果阶段由 `renderRunResultStage` 写入 `#wbRunResultBody`。现有「执行结果」摘要有 `<strong>` 标题，但产物列表无对等小标题。

## Goals / Non-Goals

**Goals:**
- 产物区始终有可读小标题，层次对齐执行中态「任务产物」。

**Non-Goals:**
- 不引入新 Tab / 新数据源。

## Decisions

1. **文案用「产物」**（非「制品」），与结果页空态/toast 用语一致；有条目时显示「产物（N）」。
2. **结构**：`<section class="wb-run-result-artifacts">` + `.wb-run-result-section-title` + 既有 `.wb-run-result-list` / 空态段落。
3. **样式**：轻量字重/字号，贴近 `.wb-daemon-review-section-title`，不新增卡片外框。

## Risks / Trade-offs

- [Risk] 与摘要「执行结果」并排时视觉重复 → Mitigation：摘要与产物分属不同 section，标题语义不同。

## Migration Plan

热更 JS/CSS；回滚删除 section 标题即可。
