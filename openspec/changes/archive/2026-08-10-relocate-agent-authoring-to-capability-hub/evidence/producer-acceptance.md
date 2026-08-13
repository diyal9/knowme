# 制作人体验验收 — relocate-agent-authoring-to-capability-hub

**日期**：2026-08-10  
**角色**：制作人  
**依据**：`proposal.md`、`qa-plan.md`（Smoke Scope）、`evidence/dev-self-test.md`、Electron 冒烟 JSON、实机截图  
**验收方式**：复跑 Electron 冒烟（25/25）+ 截图走查 + 实现代码只读审查（未改 `src/`）

---

## 总结论

**PASS — 可进入测试 QA**

本 change 的核心产品主张已落地：**能力界面 = Agent 唯一家；工作台 = 单一货架 + 一级编排 + 运行**。开发自测门禁与制作人复验一致，控制台零报错。无 BLOCKING 项；4 项风险点均为可接受或交 QA 补测的 ADVISORY。

---

## Smoke Scope（对齐 qa-plan）

| # | 检查项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | 工作台进入是单一工作流货架，无顶部 Tab | **PASS** | 冒烟 `no-mode-tabs` / `no-agent-shelf`；截图 `workbench-single-shelf.png` 无 Tab，直接进入货架 |
| 2 | 货架同格混排团队/个人，各带「团队/我的」标签；领域筛选默认全部 | **PASS** | 冒烟 4 卡 provenance `["团队","我的","团队","团队"]`；领域 chip「全部/办公/研发/视觉」可见 |
| 3 | 工作台无任何 Agent 创建/编辑/调优入口；相关操作跳转能力界面 | **PASS** | 冒烟 `no-workbench-agent-form`；编排面「去能力界面添加」；无 `wbAgentManagerForm` |
| 4 | 能力界面可新建自建 Agent，可对专家调优（Skill/知识库/Tool） | **PASS** | 冒烟 `#hubExpertDialog` 打开，52 个表单字段；截图 `capability-hub-expert-form.png` 含 ID/名称/职责/系统提示词/Skill 勾选 |
| 5 | 官方专家只读、可「复制为自建」再调优；目录无 Mock 占位 | **PASS** | `MOCK_CATALOG = null`；截图 `capability-hub-experts.png` 为真实 curated + Cursor 仓库专家（6 条）；抽屉代码含 `copyExpert` / `tuneExpert` 分支 |
| 6 | 能力界面新建/安装 Agent 后，工作台编排节点候选出现该 Agent | **PASS** | 冒烟编排候选 5 个 Agent；`studioAgentCandidates()` 读 `workbench-load` 的 `data.agents`；截图左侧候选库与能力界面目录一致 |
| 7 | 编排「新建工作流」拖 Agent 连 DAG 保存 → 以「我的」标签即时进货架 | **PASS** | 代码 `saveStudioWorkflow()` 写 `source: 'personal'` 并 `toastFn('已保存到「我的」工作流')`；货架已有「会议资料→纪要与待办（我的版本）」带「我的」标签（截图） |
| 8 | 编排节点检查器只设步骤目标，无 Agent 本体配置项 | **PASS** | 冒烟 `studio-no-agent-body-config`；检查器字段仅 name/intent/role；无 manage/save agent 按钮 |
| 9 | 管理抽屉只有执行后端 + 自动化两面板 | **PASS** | 冒烟 menu/tabs 各 2 项；截图 `workbench-manage-drawer.png` 仅「执行后端」「自动化」 |
| 10 | 助理「我的专家」与能力界面同一份数据，助理侧不可增删改 | **PASS** | 冒烟 `assistant-expert-btn-readonly-label`；popover 仅选择列表，无新建/编辑/删除入口；与 hub 专家 ID 对齐（如 office-partner、artbundle-expert） |

---

## 四个风险点

### 1. 编排「前往能力界面调优 Agent」需先选中节点

**结论：可接受（ADVISORY，非阻断）**

- 未选节点时检查器文案为「点击步骤中的 Agent，设置本步骤目标与角色」——引导明确。
- 选中已绑定 Agent 的节点后，`data-studio-tune-agent` 按钮出现并跳转能力界面专家 Tab（代码已接 `openCapabilityPicker('experts')`）。
- 编排左侧另有常驻「去能力界面添加」，不会完全找不到调优路径。
- **建议 QA**：选中节点后确认调优按钮可见、跳转正确；可考虑后续版本在未选节点时增加一行弱提示「选中步骤后可前往能力界面调优 Agent」（非本 Story 必须）。

### 2. 去 Mock 后本地无专家时的空态

**结论：产品可接受（PASS）**

- 空态文案诚实：`还没有符合条件的专家。你可以调整筛选，或添加自己的专家。`
- 提供主 CTA「添加自己的专家」（`#hubEmptyAddExpert`），非空白/非报错态。
- 当前实机环境有 curated 种子 + 已安装仓库专家，目录健康；Fresh install 空目录场景交 QA 回归补测。

### 3. 旧存档兼容（`activeWorkMode` / `shelfSource`）

**结论：代码层通过，实机旧档未测（ADVISORY）**

- `restoreTaskRoomReturnState` 注释并忽略退役字段；`setWorkMode` / 两 Tab DOM 已移除。
- 制作人未用含旧字段的 `%APPDATA%` 存档实机点开。
- **建议 QA**：导入/保留一份旧版 workbench context JSON，验证重启后货架正常、无空白/控制台报错。

### 4. 完整 E2E：复制为自建 → 保存 → 编排候选 → DAG 保存 → 货架「我的」

**结论：链路完整，自动化未全覆盖（PASS + QA 补测）**

| 环节 | 验证 |
|------|------|
| 官方「复制为自建」 | 代码 `openExpertEditor('copy')` + 抽屉 `copyExpert` 按钮 |
| 保存入 store | `expertSave` + `agentProfileSave`，保存后 `loadCatalog()` |
| 编排候选 | `workbench-load` → `data.agents` → `studioAgentCandidates()` |
| 保存工作流 | `saveStudioWorkflow()` → `source: 'personal'` → `renderShelf()` + 成功 toast |
| 货架回流 | 截图已有「我的」来源工作流卡 |

冒烟脚本未逐步点击「复制为自建→保存→拖入→保存」；架构与部分实机证据支持 PASS，**建议 QA 将上述路径列为 P0 手测用例**。

---

## 体验 / 商业化 / 一致性

### 可用性

- **心智模型清晰**：左侧 Rail「能力」配零件、「工作台」跑流程，与 proposal 一致。
- **认知负荷下降**：撤销两 Tab 后单一货架 + 来源标签，比「工作流/我的 Agent」双 Tab 更易理解。
- **编排一级入口**：「新建工作流」顶栏显眼；返回货架、保存/测试运行按钮位置合理。
- **诚实阻塞态**：团队流程缺 Agent 时显示「缺少智能体：xxx」+「暂不可用」，不像坏了。
- **窄窗**：760px 无横向溢出（冒烟 + 截图）。

### 商业化路径

- Curated 专家在能力界面「为你精选」曝光，安装/复制为自建路径完整，利于官方能力向个人沉淀。
- 团队工作流「复制并调整」保留，支持从模板 fork 到「我的」再编排，符合进阶用户付费/留存叙事。
- 工作台不再分散 Agent 编辑，减少「不知道去哪配」的流失点。

### 产品一致性

- 与 `relocate-agent-authoring-to-capability-hub` proposal 及退役 `workbench-work-modes` 方向一致。
- 视觉延续 KnowMe 暖色/workbench 绿标签体系；能力界面 embedded 模式与主壳 Rail 导航统一。
- 助理「我的专家」与能力界面专家 ID 同源，只读消费边界清楚。

---

## 自动化复验（制作人执行）

| 检查 | 结果 |
|------|------|
| Electron 冒烟 `relocate-authoring-electron-smoke.js` | **25/25 PASS**（2026-08-10 制作人复跑） |
| 控制台 error | **0** |
| 截图 | `evidence/screenshots/` 7 张（货架/编排/管理抽屉/能力目录/专家表单/助理/窄窗） |

> 注：首次复跑因残留进程导致 7/8 后超时；清理 KnowMe/electron 进程后重跑全绿。建议 CI/本地冒烟前保留 `killKnowMeProcesses()` 步骤。

---

## 阻断项（BLOCKING）

**无。**

---

## 交测试 QA 的 ADVISORY 清单

1. P0 手测：能力界面「复制为自建」→ 保存 → 工作台编排候选出现 → 拖入 DAG 保存 → 货架「我的」标签即时出现。
2. 编排选中节点后「前往能力界面调优 Agent」可见且跳转正确。
3. Fresh install / 清空专家目录后的空态截图与 CTA 可点击性。
4. 含旧 `activeWorkMode` / `shelfSource` 的 workbench context 存档恢复不空白、不报错。
5. 反模式：全局搜索确认无第二处 Agent 增删改入口；编排检查器无 Skill/知识/Tool 本体字段残留。

---

## 验收签字

- **结论**：**PASS（可进入测试 QA）**
- **验收人**：制作人
- **日期**：2026-08-10
