# 开发自测报告

- 日期：2026-08-13
- Change：fix-shelf-grid-after-task-room
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人验收（工作流任务房 → 返回 → 货架一行多卡）
- 备注：
  - 根因：返回时仍按 task-room 窄栏 `clientWidth` 计算 `shelfRowCapacity` → 1
  - 修复：先清布局再渲染；shelf 进入后再 rAF 重绘一次
