# QA Plan: polish-daemon-review-logs-fill-sse

## Smoke Scope（必填）

- [ ] 打开运行中/已失败 Daemon 任务 →「过程日志」→ 运行日志区铺满底部
- [ ] 上滚日志后等待数秒 → 滚动位置不被强制贴底；贴底时新行仍跟随
- [ ] 运行中 Network/主进程侧确认不以 2s 周期反复拉全文 `/logs`（SSE 活跃时）
- [ ] 离开任务或切换 slug → 无残留 SSE；再进终态任务可见历史日志

## Regression Scope

- [ ] 步骤 / 制品 / 变更 / 事件 Tab 仍可用
- [ ] 手动「刷新」仍能更新任务状态
- [ ] 助理 surface 不出现过程日志投影

## Anti-pattern Checks

- [ ] 日志区闪烁整页刷新感
- [ ] 空白过大或进度区挤占全部高度导致日志不可读
