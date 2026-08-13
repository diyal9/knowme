# 开发自测报告

- 日期：2026-08-13
- Change：unify-task-room-status-title-dot
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人对照三顶栏（协作 / 工作流 / 管线服务）
- 备注：
  - `foldDialogueStatusTitle`：协作/工作流有副身份时拼 `{主} · {副}`，meta 清空
  - 管线服务仍用 `Daemon 阶段 · …`；模式徽章保留
  - 标题 `max-width` 放宽至 `min(56vw, 460px)`
