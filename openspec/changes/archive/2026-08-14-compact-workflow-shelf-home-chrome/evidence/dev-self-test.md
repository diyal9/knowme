# 开发自测报告

- 日期：2026-08-13
- Change：compact-workflow-shelf-home-chrome
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 静态结构已锁（summary 在 filters 内；`shelfRowCapacity` 宽 2 / 窄 1；默认 `shelfGridExpanded = false`）
- 备注：根因是两列网格后折叠容量仍按旧 auto-fill 估成 3，导致默认露出第二行
