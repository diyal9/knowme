# 制作人体验验收: workbench-dag-branch-view

## 核心路径

| 路径 | 结论 | 证据 |
|---|---|---|
| 网关多出边显示「通过 / 打回 / 修订」与目标名 | 通过 | `renderNodeExits`；预览 `evidence/screenshots/dag-branch-view.png` |
| 循环回环显示 ↩ 指向上游，不重复画节点 | 通过 | `is-back` + ↩；实现与预览 |
| 线性主干仍为竖直箭头，可带标签芯片 | 通过 | `renderDagConnector` |
| 节点左侧类型色栏 + 起点徽标 | 通过 | `.wb-dag-node-rail` / `.wb-dag-badge`（实机 CSS 比静态预览更完整） |
| 无图时 `.degraded` 降级 | 通过 | `renderWorkflowDagHtml` 分支 |

## 体验标准

- 分支信息一眼可读，不靠脑补
- 窄侧栏不因长目标名撑破（截断由 CSS 负责）
- 只读预览，无第三方图库

## 验收结论

- [x] 通过
- 验收人：制作人
- 日期：2026-08-03
