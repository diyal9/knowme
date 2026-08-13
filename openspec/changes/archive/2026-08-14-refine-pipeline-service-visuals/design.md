## Context

`polish-pipeline-service-console` 已完成结构去重与操作台骨架；当前反馈是视觉未对齐：主 CTA 用 `#1f2120`、字号偏小、原生控件粗糙。工作台已有令牌（`--wb-accent` `#2f6f5e`、`--wb-line`、货架按钮 7–8px 圆角）。

## Goals / Non-Goals

- Goals：CSS 令牌化与货架控件视觉一致；提升可读性与主操作识别。
- Non-Goals：改布局列数、改校验文案逻辑、改协议。

## Decisions

1. **令牌优先**：daemon 局部变量继续映射到 `--wb-*`；硬编码黑/橙仅作兜底删除。
2. **字号阶梯**：lead 12–13px muted；field label 13px 650；input 13px；rail title 13px；task title 13px；meta 11.5–12px。
3. **主 CTA**：`.primary` = accent 底 + 白字（同 `.wb-shelf-run`）；`:disabled` = muted 表面（同货架禁用）。
4. **焦点**：`outline: none` + `border-color: accent` + `box-shadow: 0 0 0 3px var(--wb-accent-soft)`（与 `.wb-shelf-search:focus` 一致）。
5. **连接条**：`align-items: center`；按钮 `min-height: 28px`、字号 12px。

## Risks / Trade-offs

- 字号略增可能压缩右栏条目数 → 可接受，优先可读。
- 仅 CSS 改动，回归面小。

## Migration Plan

无数据迁移；热重载工作台即可。
