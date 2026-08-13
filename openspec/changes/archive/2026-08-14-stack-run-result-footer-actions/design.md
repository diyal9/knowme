## Context

See proposal.md — Why。结果阶段 DOM：`#wbRunStageResult > .wb-run-stage-inner`（头 / `#wbRunResultBody` / `#wbRunResultActions`）。图标用既有 `.ico[data-icon]`（`ui-icons.js`）。纯渲染层，无 IPC。

## Goals / Non-Goals

**Goals:**
- 结果阶段卡片铺满可用高度，body 伸缩、actions 贴底。
- 底栏横排 + 图标文字按钮。

**Non-Goals:**
- 输入态 / 运行中态卡片布局。
- 新图标字面量以外的图标系统改造。

## Decisions

1. **仅结果阶段覆盖 `.wb-run-stage-inner`**
   - `#wbRunStageResult`：`justify-content:stretch`；inner `flex:1; width:100%; min-height:0`。
   - `#wbRunResultBody`：`flex:1; overflow:auto`；actions `margin-top:auto`。
   - **备选**：去掉卡片、改整页背景 → 用户明确要保留产物卡片背景。

2. **按钮复用 `wb-modal-btn` + `.ico`**
   - 图标：`workflow`（返回）、`refresh`（再跑）、`history`（过程）。
   - 横排 `flex:1` 均分，便于窄栏点击。

## Risks / Trade-offs

- [Risk] 窄栏三按钮文字过长 → Mitigation：`flex:1` + 适度缩小字号/gap；必要时 ellipsis（首版不截断短文案）。
- [Risk] 输入态被连带铺满 → Mitigation：选择器限定 `#wbRunStageResult`。

## Migration Plan

热更 CSS/JS；回滚恢复居中矮卡 + 纯文字按钮即可。
