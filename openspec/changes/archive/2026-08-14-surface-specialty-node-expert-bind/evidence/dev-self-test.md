# 开发自测报告

- 日期：2026-08-12
- Change：surface-specialty-node-expert-bind
- npm test: PASS（1683/1683）
- npm run lint: PASS
- 手动冒烟: 代码侧字段/预填已接线；待 Electron 真机确认卡片「执行专家」可见且保存通

## 备注

- 根因：specialty 节点校验要求 `agentPackageId`，但画布内联字段未暴露
- 修复：卡片增加 `select-expert`；调色板添加时预填首位本地专家
