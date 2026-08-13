## Context

See proposal.md — Why。步骤微卡现为 `button.wb-daemon-review-step-card` 内直接堆 `strong`/`small`，整卡单色背景。Studio 画布已有 `wb-studio-flow-head` + sections 分区范式可参考。边界：仅渲染进程 CSS/HTML；无 IPC；延续「单卡内分区、非外层壳+内层白卡」。

## Goals / Non-Goals

**Goals:**
- 微卡内部分为 head（标题）与 body（英文名、产出）
- 状态色落在标题栏与描边，内容区保持白底

**Non-Goals:**
- 不引入端口圆点、图标列、重阴影
- 不改详情钻取逻辑与字段透传

## Decisions

1. **单 button 内 header + body，而非嵌套第二层卡**  
   结构：`wb-daemon-review-step-head` + `wb-daemon-review-step-body`。备选：外层壳包白卡 → 违反既有微卡约束。

2. **状态色主要染标题栏**  
   默认 `#eef2f6`；当前/active 暖橙浅底；error 浅红浅底；整卡 `background:#fff`，`padding:0`，`overflow:hidden`。备选：整卡铺色 → 用户明确不要。

3. **无内容时仍渲染 body 占位可选**  
   若无 secondary 与 output，省略 body 或渲染空 body 仅 head——选择省略 body，避免空白条。

## Risks / Trade-offs

- [zigzag 右对齐时 head/body 需同步 text-align] → CSS 在 `.is-zig-left` / `.is-zig-right` 分别对齐  
- [仅标题的卡变矮] → 可接受；扫读仍清晰

## Migration Plan

纯前端；回滚还原步骤卡 HTML 与 CSS 即可。
