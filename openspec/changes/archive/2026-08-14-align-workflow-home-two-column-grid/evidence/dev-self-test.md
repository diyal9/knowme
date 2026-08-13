# 开发自测报告

- 日期：2026-08-13
- Change：`align-workflow-home-two-column-grid`
- npm test: PASS
- npm run lint: PASS
- 手动冒烟:
  - 宽视口首页两列；展开限高 `min(78vh, 720px)` 至少两行
  - 页脚已去掉「模板修改于…」，仅「N 步」+ 运行按钮（因包规范化缺省 `updatedAt` 会写成加载时刻，相对时间不准）
- 备注：静态测试锁定两列、展开限高、无「模板修改于」。
