# 开发自测 — relocate-agent-authoring-to-capability-hub

**日期**：2026-08-10  
**角色**：开发  
**状态**：开发自测通过，待制作人体验验收

## 变更摘要

将 Agent 创建/编辑/调优迁至能力界面（唯一 authoring 入口）；工作台撤销两 Tab，回到单一工作流货架（团队/我的混排 + 来源标签）；编排升为一级动作；管理抽屉收敛为执行后端 + 自动化；助理「我的专家」改为只读消费。

## 改动文件

### 能力界面
- `src/capability-hub.html` — `#hubExpertDialog` 专家编辑对话框
- `src/capability-hub.js` — 去 Mock（`MOCK_CATALOG = null`）、`openExpertEditor` / `saveExpertEditor`、调优/复制/新建
- `src/capability-hub.css` — 专家表单样式

### 工作台
- `src/workspace.html` — 移除 `#wbModeTabs` / Agent 管理面板；新增 `#wbStudioSurface`、`#wbShelfNewWorkflow`；管理抽屉两 Tab
- `src/workbench.js` — 单一货架、`shelfProvenanceLabel`、`openOrchestration`、裁剪编排检查器、跳转能力界面
- `src/workbench-shelf.css` — 来源标签、编排顶栏、新建工作流按钮

### 助理
- `src/workspace-agent.js` — `availableExperts()` + `startExpertChat`，移除 createNewAgent 切换路径

### 测试
- `tests/workbench-templates.test.js` — 单一货架 / 编排 / 两面板抽屉契约
- `tests/office-assistant-mvp.test.js` — 「我的专家」只读语义
- `tests/capability-hub.test.js` — 专家表单 + Mock 移除
- `openspec/changes/relocate-agent-authoring-to-capability-hub/evidence/relocate-authoring-electron-smoke.js` — Electron 冒烟

## 门禁结果

| 检查 | 结果 |
|------|------|
| `npm test` | **1572/1572 PASS** |
| `npm run lint` | **PASS** |
| `npx openspec validate relocate-agent-authoring-to-capability-hub --strict` | **PASS** |
| `node .cursor/scripts/harness.js gate --json` | **blocking: false**（硬项 test+lint 全过） |
| Electron 冒烟 | **25/25 PASS**，控制台 error **0** |

冒烟报告：`evidence/relocate-authoring-electron-smoke.json`

## Electron 实机证据

截图目录：`evidence/screenshots/`

| 文件 | 说明 |
|------|------|
| `workbench-single-shelf.png` | 单一货架，无 Tab，含「团队/我的」来源标签 |
| `workbench-orchestration.png` | 「新建工作流」进入一级编排面，Agent 候选库可见 |
| `workbench-manage-drawer.png` | 管理抽屉仅执行后端 + 自动化 |
| `capability-hub-experts.png` | 能力界面专家目录（真实数据） |
| `capability-hub-expert-form.png` | 专家新建/调优表单 |
| `assistant-experts-readonly.png` | 助理「我的专家」只读选择 |
| `workbench-narrow.png` | 760px 窄窗无横向溢出 |

## Smoke Scope 核对（qa-plan）

- [x] 单一货架无 Tab，领域筛选默认可见
- [x] 卡片混排并带「团队/我的」标签（实机 4 卡：团队×3、我的×1）
- [x] 工作台无 `wbAgentManagerForm`；编排无 Agent 本体配置项
- [x] 能力界面 `#hubBtnAdd` 打开专家编辑表单
- [x] 编排 Agent 候选 5 个（读统一 store）
- [x] 管理抽屉 menu/tabs 各 2 项（daemon + automation）
- [x] 助理按钮 title「我的专家」，popover 可开
- [ ] **待制作人验收**：官方专家「复制为自建」完整流程、保存后进编排候选、编排保存回流货架「我的」标签

## 制作人验收注意点

1. **编排检查器「前往能力界面调优 Agent」**：需选中已绑定 Agent 的节点后才出现（冒烟时未选节点，`tuneLink: false` 属预期）。
2. **能力界面空目录**：去 Mock 后若本地无种子/安装项，空态文案为诚实提示，需确认产品可接受。
3. **旧存档**：`activeWorkMode` / `shelfSource` 已在恢复逻辑忽略；建议用含旧字段的 `%APPDATA%` 存档实机点开验证。
4. **窄窗编排面**：760px 已测无 overflow，但编排画布交互建议制作人手滑验证。

## 未宣称 Story 完成

按工作流停在**开发自测通过**，未执行 `/story-done` 或 `/opsx:archive`。

---

## 收尾修复（2026-08-10 · ADVISORY #1）

**问题**：工作台 Agent 详情弹窗仍保留「配置 Profile」二级入口，可编辑 Skill 并 `agentProfileSave`，与「Agent authoring 仅在能力界面」冲突。

**修复**（`src/workbench.js`）：
- 移除 `agent-profile` 弹窗种类及 `openAgentProfile` / `confirmModal` 保存路径
- Agent 详情改为只读 + 「前往能力界面调优 Agent」（`data-agent-tune-capability` → `openCapabilityPicker('experts')`）
- 团队资产面板 `profile` 动作改为跳转能力界面
- 导出 `openAgentDetail` 供冒烟调用

**测试**：
- `tests/workbench-templates.test.js` 新增静态断言：无 Profile 编辑、有调优跳转
- `evidence/relocate-authoring-electron-smoke.js` 新增 2 项：`agent-detail-no-profile-edit` / `agent-detail-tune-link`

**ADVISORY #2（仅已安装筛选）**：未改。curated 种子在 fresh profile 即带 installed 态，改 filter 有回归风险，留后续迭代。

### 收尾门禁（2026-08-10）

| 检查 | 结果 |
|------|------|
| `npm test` | **1573/1573 PASS** |
| `npm run lint` | **PASS** |
| `npx openspec validate relocate-agent-authoring-to-capability-hub --strict` | **PASS** |
| `node .cursor/scripts/harness.js gate --json` | **blocking: false** |
| Electron 冒烟 | **27/27 PASS**，控制台 error **0** |

新增截图：`evidence/screenshots/workbench-agent-detail-readonly.png`

