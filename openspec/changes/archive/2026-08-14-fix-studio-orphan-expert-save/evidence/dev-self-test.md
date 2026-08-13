# 开发自测报告

- 日期：2026-08-12
- Change：fix-studio-orphan-expert-save
- npm test: PASS（1714/1714）
- npm run lint: PASS
- 手动冒烟: 待制作人验收（本地已清理 `qa-copy-n1ip1s` 残留引用）
- 备注：
  - 根因：个人工作流 `my-msn1ixf2` 绑定已删除专家 `qa-copy-n1ip1s`
  - 修复：可读错误、失效下拉/画布警示、删除专家时 `clearExpertRefs`
