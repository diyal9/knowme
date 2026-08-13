# 开发自测报告

- 日期：2026-08-13
- Change：persist-studio-canvas-layout-on-save
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 需重启后：一键对齐 → 保存 → 布局应保持
- 备注：根因是 agent-graph / workflow-package 归一化剥掉 layout 与坐标；保存时已合并 studio composition 布局
