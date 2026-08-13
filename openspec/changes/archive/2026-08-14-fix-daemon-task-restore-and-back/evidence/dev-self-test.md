# 开发自测报告

- 日期：2026-08-13
- Change：`fix-daemon-task-restore-and-back`
- npm test: PASS（1829）
- npm run lint: PASS
- 手动冒烟: 待重启应用后验证
- 备注：
  - 冷启动：失效 slug / 终态草稿不再自动打开 Daemon 任务房，并清理 draft + workContext.launchIntent
  - 返回：先切面再后台 `refreshRunDirectory`，默认来源为管线服务
