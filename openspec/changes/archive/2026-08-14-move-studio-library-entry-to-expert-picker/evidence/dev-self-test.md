# 开发自测报告

- 日期：2026-08-12
- Change：move-studio-library-entry-to-expert-picker
- npm test: PASS（1685/1685）
- npm run lint: PASS
- 手动冒烟: 待 Electron 验证弹窗「专家库」入口与关闭后回弹

## 备注

- 组件栏「库」已移除
- 「选择工作台专家」标题栏常驻专家库图标+文字按钮
- 关闭专家库后 `refreshModes` 并重开选择弹窗
