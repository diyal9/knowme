# Tasks: workbench-dag-branch-view

## 1. 分支感知渲染（src/workbench.js）

- [x] 1.1 `renderWorkflowDagHtml()` 构建 `outEdges` 出边表与 `indexOf` 顺序索引
- [x] 1.2 单一顺序边 → `renderDagConnector(label)` 简洁箭头 + 标签芯片
- [x] 1.3 多出边或跳转边 → `renderDagBranch()` 分支 fork，逐条显示「标签 → 目标节点名」
- [x] 1.4 指向上游（已出现）节点的边标注 `↩ 回到 X`
- [x] 1.5 新增标签色调映射 `DAG_LABEL_TONE` / `dagLabelTone()`

## 2. 视觉升级（src/workspace.html）

- [x] 2.1 节点卡改 1px 细边 + 圆角 + 轻投影 + 左侧类型色栏（`.wb-dag-node-rail`）
- [x] 2.2 各类型（agent/script/loop/parallel/gate/terminal）色栏与类型 pill 配色
- [x] 2.3 移除菱形/圆形异形节点样式与中央竖脊线 `.wb-dag-flow::before`
- [x] 2.4 新增 `.wb-dag-link-label` 与 `.wb-dag-branch*` 及 `.tone-*` 语义配色
- [x] 2.5 清理死 CSS：`wb-dag-io / wb-dag-next / wb-dag-agent / wb-dag-meta-label`

## 3. 门禁（开发自测）

- [x] 3.1 `npm test` 通过（752 pass / 0 fail）
- [x] 3.2 `npm run lint` 无 error
- [x] 3.3 保留 templates 测试约束的选择器（`.wb-dag-panel/.wb-dag-link/.wb-dag-flow overflow-y:auto/.wb-dag-flow-shell/.wb-dag-head-subtitle`），未引入 `wb-dag-io/wb-dag-next-item`
- [x] 3.4 写 evidence/dev-self-test.md
