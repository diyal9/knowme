## 1. 移除顶栏入口

- [x] 1.1 从 `workspace.html` 删除 `#wbRunningToggle` 与 `#wbRunningPopover` 及相关子节点
- [x] 1.2 清理 `workbench-shelf.css` 中仅服务该控件的样式

## 2. 拆除接线

- [x] 2.1 从 `workbench.js` 移除 toggle/popover 变量、显隐函数、点击与外侧关闭监听
- [x] 2.2 删除或收缩仅服务 popover 的 `renderRunList` 路径；修正引导文案中「货架进行中入口」表述

## 3. 契约与自测

- [x] 3.1 更新 `tests/workbench-templates.test.js`：断言顶栏进行中入口已移除
- [x] 3.2 跑 `npm test` / `npm run lint`，写 `evidence/dev-self-test.md`
