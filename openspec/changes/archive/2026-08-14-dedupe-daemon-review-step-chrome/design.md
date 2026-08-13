## Context

步骤 Tab 进度块渲染了 `daemonRunIdentityTitle()`，与顶栏标题同文；`wbDaemonReviewRec` 在非推荐 Tab 时显示「推荐查看「…」」。

## Goals / Non-Goals

- Goals：去掉重复标题行；去掉推荐文案行；保留静默 Tab 推荐。
- Non-Goals：不改推荐算法；不改顶栏。

## Decisions

1. 从 `renderDaemonReviewBody` 的 progress 块删除 `wb-daemon-review-progress-title`。
2. 删除 `wbDaemonReviewMeta` / `wbDaemonReviewRec` DOM 与相关 JS/CSS；`projectReviewSurface.recommendation` 可置空或移除展示路径。
3. `recommendTab` 保留，仅用于默认 `activeTab`。

## Risks / Trade-offs

- 失败用户可能少一条引导 → 可接受：失败已默认切日志 Tab。
