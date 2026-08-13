# Polish OpenSpec 归档清单

扫描时间：2026-08-13  
条件：`tasks.md` 全勾选 + `evidence/dev-self-test.md` + `qa-plan.md`

## 可尝试 `/story-done` 或 archive（19）

| Change | tasks | evidence | qa-plan | 备注 |
|--------|-------|----------|---------|------|
| polish-agent-execution-progress | 7/7 | ✓ | ✓ | 可归档 |
| polish-capability-and-workflow-authoring | 21/21 | ✓ | ✓ | 体量大，建议单独 story-done |
| polish-daemon-artifacts-folder | 6/6 | ✓ | ✓ | |
| polish-daemon-progress-md-tables | 6/6 | ✓ | ✓ | |
| polish-daemon-progress-preview-collapse | 4/4 | ✓ | ✓ | |
| polish-daemon-result-actions-and-back | 5/5 | ✓ | ✓ | |
| polish-daemon-review-logs-fill-sse | 11/11 | ✓ | ✓ | |
| polish-daemon-review-ux | 8/8 | ✓ | ✓ | |
| polish-expert-collab-dialogue | 17/17 | ✓ | ✓ | 有 acceptance |
| polish-knowledge-home-layout | 9/9 | ✓ | ✓ | |
| polish-link-preview-toolbar | 5/5 | ✓ | ✓ | |
| polish-pipeline-service-console | 8/8 | ✓ | ✓ | |
| polish-studio-canvas-node-summary-icons | 10/10 | ✓ | ✓ | |
| polish-studio-node-card-chrome | 6/6 | ✓ | ✓ | |
| polish-task-composer-schedule | 8/8 | ✓ | ✓ | 叙事由本 change 收敛 |
| polish-workbench-team-empty-state | 6/6 | ✓ | ✓ | |
| polish-workflow-dialogue-side-rail | 5/5 | ✓ | ✓ | |
| polish-workflow-run-surface | 8/8 | ✓ | ✓ | |
| polish-workflow-shelf-cards | 8/8 | ✓ | ✓ | |
| polish-workflow-studio-canvas-nav | 8/8 | ✓ | ✓ | |

## 开发完成但缺 qa-plan（4）— 先补 qa-plan 再归档

| Change | 缺项 |
|--------|------|
| polish-agent-chat-response-layout | qa-plan |
| polish-daemon-path-select-dividers | qa-plan（有 acceptance） |
| polish-expert-editor-dialog | qa-plan |
| polish-workbench-navigation-shell | qa-plan |

## 未完成 — 勿 archive

| Change | 状态 |
|--------|------|
| polish-code-workspace-cache-git-status | 0/12 tasks |

## 关联可收敛（非 polish 前缀）

| Change | 说明 |
|--------|------|
| enable-workbench-task-schedule | tasks 全完成；叙事/边界由本 change 补齐后可 story-done |
| polish-task-composer-schedule | 同上 |

## 建议批次

1. **小 polish 批次**（≤5）：daemon-artifacts-folder、progress-md-tables、progress-preview-collapse、result-actions-and-back、link-preview-toolbar
2. **中批次**：workflow 系列 shelf/run/dialogue-studio-nav
3. **大项单独**：capability-and-workflow-authoring、expert-collab-dialogue、daemon-review-logs-fill-sse

本次会话**未执行 archive**，避免跳过制作人验收/测试门禁。
