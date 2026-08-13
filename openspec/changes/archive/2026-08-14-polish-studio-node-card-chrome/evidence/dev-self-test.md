# 开发自测报告

- 日期：2026-08-12
- Change：polish-studio-node-card-chrome
- npm test: PASS（1714 → 含新增 canvas css chrome 用例）
- npm run lint: PASS
- 手动冒烟: 样式已落地；需重启 Electron 后在工作室画布目视确认 tool/knowledge/llm 头栏与空态层次
- 备注：
  - 头栏改为各 kind 全宽 tint，去掉顶边 3px 色条
  - 正文：标签弱化、已填加粗、`is-warn` 类型色强调、`is-empty` 弱化空态
