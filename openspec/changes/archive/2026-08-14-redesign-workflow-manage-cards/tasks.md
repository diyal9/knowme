## 1. 返回与面板头

- [x] 1.1 工作流管理页隐藏左侧文字 `#wbManageBack`；在面板头右侧增加图标返回按钮并绑定回货架
- [x] 1.2 调整 `.wb-panel-head` / 操作组布局，使「返回图标 + 新建」靠右

## 2. 两列卡片与上下分区

- [x] 2.1 `.wb-workflow-manage-list` 改为两列 grid（窄屏单列）
- [x] 2.2 重写 `workflowManageItemHtml`：上区名称/简介/能力摘要，下区简要流程步骤条
- [x] 2.3 编辑、删除改为图标按钮（`edit` / `trash`），保留确认删除

## 3. 自测与证据

- [x] 3.1 更新相关模板/结构测试断言
- [x] 3.2 `npm test` + `npm run lint` 通过；写 `evidence/dev-self-test.md`
