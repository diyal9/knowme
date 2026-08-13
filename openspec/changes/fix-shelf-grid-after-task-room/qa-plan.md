# QA Plan — fix-shelf-grid-after-task-room

## Smoke Scope

- [ ] 工作流货架开任务 → 对话房返回 → 货架显示一行多卡（非仅 1 张）+「更多」仅含剩余
- [ ] 点「更多/收起」仍正常
- [ ] 任务 Tab ↔ 工作流 Tab 切换货架/任务首页正常
- [ ] 专家任务房返回任务首页不受影响

## Anti-patterns

- 返回后仍只见 1 张宽卡片
- 需手动 resize 窗口才恢复多卡
