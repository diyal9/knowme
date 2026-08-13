## 1. DOM 入口

- [x] 1.1 在 `workspace.html`「你的工作流任务」标题旁增加设置按钮（对齐 `wbTaskManage`）
- [x] 1.2 在 `workbench.js` 绑定点击 → `openTaskManageHub('workflow')`

## 2. 管理弹窗作用域

- [x] 2.1 为 `openTaskManageHub` / 策略 map / 卡片渲染增加 `expert` | `workflow` 作用域
- [x] 2.2 工作流作用域：标题/空态/hint/aria 文案；卡片展示工作流名 + 头像回退
- [x] 2.3 删除后同步货架任务列表与 `elShelfRecentEmpty`；重新打开按当前 scope 刷新

## 3. 测试与自测

- [x] 3.1 更新 `tests/workbench-templates.test.js` 断言货架管理入口与 scope
- [x] 3.2 补充 `qa-plan.md` / `acceptance.md`；跑 `npm test` 与 `npm run lint`
