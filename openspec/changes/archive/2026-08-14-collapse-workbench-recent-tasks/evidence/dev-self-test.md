# 开发自测报告

- 日期：2026-08-12
- Change：collapse-workbench-recent-tasks
- npm test: PASS（1687/1687）
- npm run lint: PASS
- 手动冒烟: 代码路径已接好（默认预览 3 条 +「更多/收起」+ 展开列表滚动）；待重启 Electron 后目视确认首屏
- 备注：
  - 默认 `TASK_RECENT_PREVIEW = 3`
  - 展开后 `.wb-task-recent-list.is-expanded` 限高滚动；`wb-body` 保留页面滚动
