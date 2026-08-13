## Context

承接 `polish-workflow-shelf-cards` 与 `show-workflow-card-updated-at`。渲染层已有 mark / chips / footer updated。见 proposal.md - Why。纯渲染/CSS，无 IPC。

## Goals / Non-Goals

**Goals:** 降低边框噪音；页脚成为完整 meta 行；领域图标可扫读。

**Non-Goals:** 不改 package 字段；不重排货架。

## Decisions

1. **Chip**：无边框软底；仅「输入」「产出」两枚；值略放宽 ellipsis。
2. **步骤**：移入页脚左侧 meta，与「更新于」用中点分隔（`1 步 · 更新于 2 天前`）。
3. **操作**：`inspect` 加 `.is-primary`（软 accent 底）；次按钮无边框幽灵态。
4. **领域图标**：`office→note`，`engineering→code`，`visual→image`，默认 `workflow`。
5. **分隔**：footer 顶 `border-top` + padding，与内容区分。

## Risks / Trade-offs

- [步骤离开 chip 后「三问」仍需覆盖] → 步骤改在页脚仍可见，可运行态不变。
- [幽灵按钮可发现性] → hover 显边框；主按钮仍有色底。

## Migration Plan

纯前端；回滚 CSS/HTML 即可。
