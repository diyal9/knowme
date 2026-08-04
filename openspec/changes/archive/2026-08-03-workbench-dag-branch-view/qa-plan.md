# QA Plan: workbench-dag-branch-view

## Smoke Scope

- [x] 含网关的工作流：节点卡内出现「通过 / 打回 / 修订」出口徽标，带目标节点名
- [x] 含循环的工作流：回环边显示 ↩，不重复渲染上游节点卡
- [x] 线性工作流：节点间仍为简洁竖向箭头（可带标签芯片）
- [x] 入口节点带「起点」徽标；节点有类型色栏 class
- [x] graph 不可用时面板 `.degraded`，不抛错

## 反模式检查（Tester）

- [x] 长目标名不撑破侧栏（CSS 截断）
- [x] 回环不重复画节点
- [x] 无第三方图库 / XSS 经 `esc()`

## 自动化

- `npm test`：`tests/workbench-templates.test.js`
- `npm run lint`
