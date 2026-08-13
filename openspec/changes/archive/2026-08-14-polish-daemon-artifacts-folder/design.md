## Context

审阅右栏制品 Tab 已在 `workbench.js` 用 `renderDaemonReviewBody('artifacts')` 渲染纯文本空态与文件名行；投影来自 `workbench-daemon-review.projectArtifacts`（含 `name` / `path` / `size` / `downloadUrl`）。视觉基线与 `polish-daemon-review-ux` 扁平审阅面一致。渲染进程只改 DOM/CSS；不新增 IPC。See proposal.md — Why。

## Goals / Non-Goals

**Goals:**
- 投影层提供空态文案（按 status）与展示辅助字段，UI 组装文件夹式行。
- 复用 StickyIcons（`folder` / `file`）与现有 `fmtWorkspaceSize` 风格。

**Non-Goals:**
- 不实现制品目录树；不改 Daemon artifacts API。

## Decisions

1. **空态文案放纯函数 `artifactEmptyState(status)`**  
   - 理由：可单测、与 `projectReviewSurface` 一致。  
   - 备选：硬编码在 `workbench.js` — 难测、易漂移。

2. **有制品时才显示「预览」提示；空态改为图标面板 + 可选「查看步骤」按钮**  
   - 理由：截图中失败 0% 仍提示预览是粗糙主因。  
   - 备选：始终显示 tip — 拒绝，误导。

3. **文件行对齐代码工作区文件节点气质（图标 + 名 + 尺寸），不用嵌套卡**  
   - 理由：与审阅面「去卡套卡」一致。  
   - 备选：大卡片网格 — 过重。

## Risks / Trade-offs

- [Risk] 状态枚举不全导致文案不准 → Mitigation：未知状态回落到通用「暂无制品」。
- [Risk] StickyIcons 未 mount → Mitigation：渲染后调用 `StickyIcons.mount`（与其它 Tab 一致）。

## Migration Plan

纯前端；无数据迁移。回滚即还原 artifacts 分支 HTML/CSS 与 review 辅助函数。
