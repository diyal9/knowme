# 开发自测报告

- 日期：2026-08-13
- Change：relocate-workflow-copy-to-manage
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人验收（货架仅运行；管理面复制在编辑旁）
- 备注：
  - `shelfCardHtml` footer 仅保留 `inspect`/play
  - `workflowManageItemHtml` 增加 `data-workflow-manage="fork"`（复制 · 编辑 · 删除）
  - 管理面 hint / 空态文案已去掉「去工作流复制」误导
