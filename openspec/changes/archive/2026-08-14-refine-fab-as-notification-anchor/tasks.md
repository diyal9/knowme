## 1. 贴角与文案

- [x] 1.1 收紧 `#km-fab-root` 默认 `right`/`bottom` 与脚本 `RIGHT_MARGIN`（≤8px）
- [x] 1.2 面板副标题改为通知向文案；`aria-label`/`title` 与通知锚点一致

## 2. 移除 Session 恢复面

- [x] 2.1 删除 `#km-fab-resume` DOM、相关 CSS 与 resume 渲染/同步/dismiss 逻辑
- [x] 2.2 红点不再由可恢复 Session 驱动；无通知时保持 hidden

## 3. 回归

- [x] 3.1 更新断言 FAB resume 的静态测试
- [x] 3.2 `npm test` 与 `npm run lint`；写 `evidence/dev-self-test.md`
