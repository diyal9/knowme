# Code Review: relocate-agent-authoring-to-capability-hub

**日期**：2026-08-10  
**结论**：**通过** — 核心主张已落地；收尾移除工作台 Profile 编辑残留后，Agent authoring 入口已完全收敛至能力界面。

## 审查范围

- 能力界面 Agent 创建/编辑/调优（`capability-hub.js` / `capability-hub-service.js`）
- 工作台单一货架、一级编排、两面板管理抽屉（`workbench.js` / `workspace.html`）
- 助理「我的专家」只读（`workspace-agent.js`）
- 收尾：Agent 详情弹窗 Profile 编辑移除

## 要点

| 项 | 结果 |
|----|------|
| 工作台无 Agent CRUD 表单 | PASS |
| 编排检查器无 Agent 本体配置 | PASS |
| 能力界面承担 authoring | PASS |
| 工作台 Agent 详情无 `agentProfileSave` 路径 | PASS（收尾修复） |
| 运行三段式 / workflow-package 未改 | PASS |

## 残留 / 后续

- Fresh profile「仅已安装」筛选仍可见 curated 种子（ADVISORY，留后续）
- 主 specs 已在 story-done 前同步至 `openspec/specs/`

**审查人**：Developer（收尾归档）
