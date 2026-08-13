## 1. Shelf footer

- [x] 1.1 `shelfCardHtml` 移除次按钮（fork/edit），footer 仅保留运行按钮
- [x] 1.2 更新管理面 hint / 空态，去掉「去工作流复制」误导文案

## 2. Manage copy action

- [x] 2.1 `workflowManageItemHtml` 在编辑前增加复制图标按钮
- [x] 2.2 `handleWorkflowManageAction` 处理 `fork`，调用 `forkWorkflowPackage`

## 3. Manage IO bars

- [x] 3.1 管理卡输入/产出改为上下两行矩形背景条（非 pill 同行）

## 4. Tests & self-check

- [x] 4.1 更新 `tests/workbench-templates.test.js` 断言（fork 在管理卡，货架无 fork）
- [x] 4.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md` 与 `qa-plan.md`
