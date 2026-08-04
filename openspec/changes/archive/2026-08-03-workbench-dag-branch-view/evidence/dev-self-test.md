# Dev Self-Test: workbench-dag-branch-view

日期：2026-08-03
角色：开发

## 变更范围

- `src/workbench.js`：`renderWorkflowDagHtml()` 分支感知重写；新增 `renderDagBranch()`、`renderDagConnector(label)`、`DAG_LABEL_TONE` / `dagLabelTone()`
- `src/workspace.html`：DAG 节点/连接器/分支 CSS 重写（类型色栏、语义标签色调），移除异形节点与中央竖脊线及死 CSS

## 门禁结果（node .cursor/scripts/harness.js gate --json）

- `gate.ok = true`，`blocking = false`
- 硬项 `npm-test`：**pass**（`tests 752 / pass 752 / fail 0`）
- 硬项 `npm-lint`：**pass**（无 error）
- 软项：本 change 的 `CODE-REVIEW-MISSING` 为 advisory（code-review 属后续测试/评审门禁，非开发自测阶段产出）

## 关键回归约束

- 保留 `tests/workbench-templates.test.js` 断言的选择器：`.wb-modal-dag`、`.wb-dag-panel`、`.wb-dag-link`、`.wb-dag-flow`(overflow-y:auto)、`.wb-dag-flow-shell`、`.wb-dag-head-subtitle`；`renderWorkflowDagHtml(` 函数存在
- 未引入被禁断言 `wb-dag-io` / `wb-dag-next-item`

## 待人工验收

- 制作人体验验收（含并行/网关/循环工作流的真机观感）
- 测试 QA（qa-plan Smoke Scope + 反模式）
- 建议截图证据落 `evidence/screenshots/`（可用 Playwright 起工作台后截取启动弹窗右侧 DAG）
