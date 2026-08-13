## 1. 样式

- [x] 1.1 为当前/执行中/等待中步骤的 `.wb-daemon-review-step-mark` 增加实心核 + 脉冲扩散环动画
- [x] 1.2 `prefers-reduced-motion: reduce` 下关闭动画并保留静态高亮
- [x] 1.3 确认 `is-current` 与 `status-active|running|waiting` 均覆盖；必要时最小补齐选择器

## 2. 自测

- [x] 2.1 `npm test` 与 `npm run lint` 通过
- [x] 2.2 写 `evidence/dev-self-test.md`；手动确认执行中任务步骤 Tab 当前圆点有动效
