# Code Review: workbench-dag-branch-view

角色：开发（自审）
日期：2026-08-03

## 变更文件

- `src/workbench.js`
  - `renderWorkflowDagHtml()`：读取 `graph.edges` 构建 `outEdges` 出边表 + `indexOf` 顺序索引
  - 每节点区分**主路径边**（指向 `order[index+1]`）与**次要边**（分支/异常/回环）
  - 主路径 → `renderDagConnector(label)` 竖直主干箭头（仅有意义标签才挂芯片）
  - 次要边 → `renderNodeExits()` 卡片内出口小徽标；回环用 `↩`
  - 新增 `DAG_LABEL_TONE` / `dagLabelTone()` 语义色调映射
- `src/workspace.html`
  - DAG 节点卡：1px 细边 + 圆角 + 轻投影 + 左侧类型色栏（`.wb-dag-node-rail`）
  - 新增 `.wb-dag-node-exits` / `.wb-dag-exit*` 卡内出口样式与 `.tone-*` 配色
  - 移除菱形/圆形异形节点、中央竖脊线及死 CSS（`wb-dag-io/next/agent/meta`、`wb-dag-branch*`）

## 审查要点

- **无回归**：`npm test` 758/758；`npm run lint` ok（含 script-scope）
- **测试约束保留**：`.wb-modal-dag/.wb-dag-panel/.wb-dag-link/.wb-dag-flow(overflow-y:auto)/.wb-dag-flow-shell/.wb-dag-head-subtitle` 与 `renderWorkflowDagHtml(` 均在；未引入 `wb-dag-io/wb-dag-next-item`
- **无第三方依赖**：纯自绘，零打包体积、零 CSP 风险
- **XSS**：节点标题、边标签、目标名均经 `esc()`
- **边界**：`edges` 为空 → 无出口徽标；`graph` 缺失/无节点 → `.degraded` 降级；主路径边缺失时全部边降级为出口徽标，主干退化为无标签连线（无信息丢失）
- **可访问性**：连接器/出口为 `aria-hidden`，flow 容器保留 `role=region tabindex=0`

## 结论

开发侧通过。视觉观感需制作人验收（见 evidence/screenshots/dag-branch-view.png）。
