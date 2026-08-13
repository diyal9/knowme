# 开发自测报告

- 日期：2026-08-11
- Change：`clarify-workflow-shelf-naming-and-detail`
- npm test: PASS（1647/1647，含 `tests/workflow-display-name.test.js` 5 项）
- npm run lint: PASS
- 手动冒烟: CODE-PATH VERIFIED（见下；制作人体验验收时请真机点一遍）

## 实现核对

| 项 | 结果 |
|---|---|
| 展示短名模块 | `src/lib/workflow-display-name.js`；脚本已挂 `workspace.html` |
| 管道名 / fork 后缀 | 单测覆盖；`package.name` 不被改写 |
| 货架标题 / 搜索 | `shelfCardHtml` / `shelfItems` 使用 display + haystack |
| 图标次要操作 | `wb-shelf-icon-btn` + `copy` / `edit`；「开始」仍为文字 |
| 运行 / 管理标题 | `renderRunInputStage`、`syncRunTopbar`、`workflowManageItemHtml` |
| 居中详情 | `modal.kind = 'workflow-detail'`，复用 `#wbWorkflowModal` |
| 点击分区 | 按钮 `stopPropagation`；卡片 body / Enter·Space 开详情 |
| 详情开始 | `confirmModal` → `handleFlowLibraryAction('use')` |
| 关闭 | 既有关闭按钮 / Escape / 遮罩点击 |

## 备注

- 缓存：`workbench-shelf.css?v=2`、`workbench.js?v=shelf-detail1`、`workflow-display-name.js?v=1`
- 下一步：制作人按 `acceptance.md` 真机验收后放行测试
