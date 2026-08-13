# QA Plan — fix-daemon-task-restore-and-back

## Smoke Scope

- [ ] 冷启动：失效 slug 草稿不自动打开 Daemon 任务房
- [ ] 冷启动：列表中仍存在的进行中任务可恢复，返回 → 管线服务
- [ ] 管线服务 → 打开任务 → 返回：立即离开且落到管线首页
- [ ] 货架启动的 daemon 跑批（有 `returnState.surface=shelf`）返回仍回货架
- [ ] 控制台无 uncaught error
