## 1. Markup & copy

- [x] 1.1 调整 `shelfCardHtml` 为上半 `card-top`（mark + 标题行徽章 + 说明 + chips）/ 下半 `card-bottom`（简要流程 + footer），不渲染复制/编辑/删除
- [x] 1.2 将 `shelfFooterMetaHtml` 中「更新于」改为「模板修改于」，保留 `datetime` / `title`
- [x] 1.3 更新 `workbench-shelf.css`，使货架卡 chrome 对齐管理卡分区与输入/产出条样式

## 2. Tests & evidence

- [x] 2.1 更新 `tests/workbench-templates.test.js`：断言「模板修改于」、首页无 manage 菜单、保留运行页脚
- [x] 2.2 运行 `npm test` 与 `npm run lint`，写入 `evidence/dev-self-test.md`
