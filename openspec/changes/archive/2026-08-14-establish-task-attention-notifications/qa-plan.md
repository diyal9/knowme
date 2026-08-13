# QA Plan: establish-task-attention-notifications

## Smoke Scope（必填）

- [ ] 前台：Daemon 进入 gate/clarify 且不在该任务焦点 → FAB 有条目 + 红点 + 间歇动画
- [ ] 点击铃铛打开面板 → 动画停止；条目仍可见
- [ ] 提交 HITL 后 → 条目清除
- [ ] 工作台 hide 到托盘后再进 HITL → 右下角暗色桌面提示窗出现
- [ ] 点击提示窗 → 工作台显示并聚焦
- [ ] FAB 无「继续工作」Session 卡

## Regression Scope

- [ ] 日志快捷仍可用
- [ ] 拖动铃铛位置持久化
- [ ] `prefers-reduced-motion` 下无脉冲动画

## Anti-pattern Checks

- [ ] 同一 HITL 是否每 2s 刷一条
- [ ] 已在任务 HITL 卡前是否过度打扰
- [ ] toast 是否挡死系统托盘点击
