# 开发自测报告

- 日期：2026-08-12
- Change：redesign-workflow-manage-cards
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人验收（结构已就位：右侧返回图标、两列网格、上下分区、编辑/删除图标）
- 备注：
- 顶栏文字「返回」在 workflows 管理面已隐藏
- 面板头：**左侧** `wb-task-back`（图标+「返回」）回货架；**右侧**仅「+ 新建工作流」
- 卡片上区简介 + 输入/产出 chip；下区 `A → B → C` 简要流程
- 删除走应用内确认弹窗 `#wbWorkflowDeleteModal`
