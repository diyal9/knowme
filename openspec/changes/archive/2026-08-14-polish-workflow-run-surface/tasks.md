## 1. 结构与样式

- [x] 1.1 调整确认输入 / 产物卡片 DOM：阶段指引、表单、元信息区、操作区
- [x] 1.2 在 `workbench-shelf.css` 打磨顶栏、步进、卡片、字段、元信息、焦点态

## 2. 渲染逻辑

- [x] 2.1 `renderRunInputStage`：去重标题/产出；字段标签无 type；必填徽章
- [x] 2.2 产品向后端文案 + 可选参与专家 chips
- [x] 2.3 结果阶段文案/布局与同外壳一致（无回归）

## 3. 验证

- [x] 3.1 更新 `tests/workbench-templates.test.js` 契约
- [x] 3.2 `npm test` / `npm run lint` 通过（lint 全过；test 仅 1 个无关 agent composer 断言失败）
- [x] 3.3 写 `evidence/dev-self-test.md`
