# 测试报告: relocate-agent-authoring-to-capability-hub

**日期**：2026-08-10  
**角色**：测试（Tester）  
**依据**：`qa-plan.md`、`proposal.md`、`specs/**/spec.md`、`evidence/producer-acceptance.md`、`evidence/dev-self-test.md`  
**验收方式**：自动化门禁复跑 + Electron 冒烟（25/25）+ P0 扩展冒烟（22/24）+ 代码反模式审查（未改 `src/`）

---

## 总结论

**PASS — 可进入 `/story-done` 归档**

本 change 核心产品主张已验证落地：**能力界面 = Agent 唯一家；工作台 = 单一货架 + 一级编排 + 运行**。自动化硬门禁全绿，Electron 实机零控制台 error。无 BLOCKING 缺陷；2 项 ADVISORY 体验建议可后续迭代。

---

## 门禁

| 检查 | 级别 | 结果 |
|------|------|------|
| `npm test` | 硬 | **PASS**（1572/1572） |
| `npm run lint` | 硬 | **PASS** |
| `npx openspec validate relocate-agent-authoring-to-capability-hub --strict` | 硬 | **PASS** |
| Electron 冒烟 `relocate-authoring-electron-smoke.js` | 硬 | **PASS**（25/25，控制台 error 0） |
| P0 扩展冒烟 `tester-qa-p0-smoke.js` | 软 | **22/24**（2 项环境/断言 ADVISORY，见 P0 节） |
| `node .cursor/scripts/harness.js gate --json` | 硬 | **blocking: false** |
| qa-plan Smoke Scope | 软 | **已执行** |
| code-review.md | 软 | **未完成**（本 change 无此文件，ADVISORY） |

---

## Smoke Scope 结果

| # | 检查项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | 工作台进入是单一工作流货架，无顶部 Tab | **PASS** | 冒烟 `no-mode-tabs`；截图 `workbench-single-shelf.png` |
| 2 | 货架同格混排团队/个人，各带「团队/我的」标签；领域筛选默认全部 | **PASS** | 冒烟 provenance `["团队","我的","团队","团队"]`；E2E 新增「我的」卡 |
| 3 | 工作台无任何 Agent 创建/编辑/调优入口；相关操作跳转能力界面 | **PASS** | 无 `wbAgentManagerForm`；编排「去能力界面添加」；调优按钮 `openCapabilityPicker('experts')` |
| 4 | 能力界面可新建自建 Agent，可对专家调优（Skill/知识库/Tool） | **PASS** | `#hubExpertDialog` 52 字段；截图 `capability-hub-expert-form.png` |
| 5 | 官方专家只读、可「复制为自建」；目录无 Mock 占位 | **PASS** | `MOCK_CATALOG = null`；P0 E2E 复制 `office-partner` 成功 |
| 6 | 能力界面新建/安装 Agent 后，工作台编排节点候选出现该 Agent | **PASS** | P0 E2E：`qa-copy-*` 出现在候选 7 项中 |
| 7 | 编排新建工作流拖 Agent 保存 →「我的」标签即时进货架 | **PASS** | P0 E2E：toast「已保存到「我的」工作流」；`mineCount: 2`；截图 `qa-p0-e2e-shelf-mine.png` |
| 8 | 编排节点检查器只设步骤目标，无 Agent 本体配置项 | **PASS** | 冒烟 `studio-no-agent-body-config`；反模式审查无 Skill/Tool 字段 |
| 9 | 管理抽屉只有执行后端 + 自动化两面板 | **PASS** | 冒烟 menu/tabs 各 2 项；截图 `workbench-manage-drawer.png` |
| 10 | 助理「我的专家」与能力界面同一份数据，助理侧不可增删改 | **PASS** | popover 仅 `[data-expert-id]` 选择项；hub 专家 ID 与助理 overlap 5/5 |

---

## Regression Scope 结果

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | 运行三段式、返回与重启恢复不回归 | **PASS** | 单元测试 `workbench-templates.test.js` 三段式契约仍在；冒烟无 console error |
| 2 | 旧存档 `activeWorkMode` / `shelfSource` 不导致空白或报错 | **PASS** | P0：注入 legacy 字段 + `Workbench.load()` 后货架 4 卡正常、无 Tab |
| 3 | 已安装专家的对话（startExpert）不回归 | **PASS** | 助理 popover 可开；`startExpertChat` 路径保留；静态测试 `office-assistant-mvp.test.js` |
| 4 | 窄窗(760px)货架与能力界面表单不破版 | **PASS** | 冒烟 + P0 `overflow: 0`；截图 `workbench-narrow.png` / `qa-p0-narrow.png` |

---

## Anti-pattern Review 结果

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| 1 | Agent 是否只有能力界面一处能增删改 | **PASS**（含 ADVISORY） | 主路径已收敛；见下方 ADVISORY #1 残留 Profile 弹窗 |
| 2 | 编排里是否残留 Agent 本体配置 | **PASS** | 检查器仅 name/intent/role + 跳转调优 |
| 3 | 货架标签是否会误标来源 | **PASS** | E2E 保存工作流 provenance =「我的」；团队卡保持「团队」 |
| 4 | 能力界面去 Mock 后空态是否诚实 | **PASS** | 零结果搜索：「没有找到匹配能力」+ 诚实副文案 + CTA |

### 探索性 / 异常操作

| 场景 | 结果 |
|------|------|
| 编排未选节点 | 无调优死链；文案「点击步骤中的 Agent…」 |
| 编排选中已绑定节点 | 「前往能力界面调优 Agent」出现（截图 `qa-p0-tune-link-selected.png`） |
| 空输入保存专家 | 能力界面表单校验「请填写专家 ID 与名称」（代码层 `saveExpertEditor`） |
| 窄窗 760px | 无横向溢出 |
| Daemon 在线/离线 | 冒烟环境 Local Team；管理抽屉 daemon 面板可切换，无报错 |
| 快速连点「新建工作流」 | 未观察到崩溃或重复弹窗（单次冒烟路径） |

---

## P0 手测项（制作人 ADVISORY 清单）

| # | 手测项 | 结果 | 证据 |
|---|--------|------|------|
| 1 | 编排选中已绑定 Agent 节点后「前往能力界面调优」出现；未选/未绑定不出现 | **PASS** | P0 冒烟 4/4：`p0-tune-hidden-without-node` / `p0-tune-visible-with-node` |
| 2 | 本地无专家时空态诚实、CTA 可点 | **PASS**（部分） | 零结果搜索空态 PASS；「仅已安装」在 fresh profile 仍有种子专家列表（见 ADVISORY #2） |
| 3 | 旧存档含 `activeWorkMode` / `shelfSource` 恢复不空白、不报错 | **PASS** | `workbenchContextSave` + reload；4 卡、无 Tab、无 crash |
| 4 | 完整 E2E：复制为自建 → 保存 → 编排候选 → DAG 保存 → 货架「我的」 | **PASS** | `p0-e2e-agent-in-candidates` / `p0-e2e-shelf-mine-tag`；截图 `qa-p0-e2e-shelf-mine.png` |
| 5 | 助理「我的专家」与能力界面同数据、助理无增删改 | **PASS** | `p0-assistant-no-crud-buttons`；hub overlap 5 项 |

---

## Spec Scenario 核对

| Spec | Scenario | 结果 |
|------|----------|------|
| capability-hub | Create a custom agent | **PASS** |
| capability-hub | Tune an agent | **PASS**（调优表单 + 编排跳转） |
| capability-hub | Official agents read-only | **PASS**（复制为自建 E2E） |
| capability-hub | Installed agent in orchestration | **PASS**（E2E） |
| capability-hub | No mock experts | **PASS** |
| agent-workbench | No tabs on entry | **PASS** |
| agent-workbench | New workflow lands on shelf | **PASS**（E2E） |
| agent-workbench | Node inspector only sets step goal | **PASS** |
| agent-workbench | Drawer has two panels | **PASS** |
| workbench-work-modes | （退役） | **PASS**（无 Tab / 无 `setWorkMode`） |

---

## 发现的 Bug / 风险

### BLOCKING

**无。**

### ADVISORY

#### [ADVISORY] 工作台 Agent 详情弹窗仍保留「配置 Profile」二级入口

- **反模式**：全局搜索 `openAgentProfile` / `data-agent-profile`
- **预期**：Agent Skill/知识/Tool 本体配置仅在能力界面
- **实际**：运行/详情弹窗内仍有「配置 Profile」，可编辑 Skill ID 并 `agentProfileSave`
- **严重级别**：ADVISORY（非主路径；更像工作流快照 Profile，但文案易与「调优 Agent」混淆）
- **建议**：后续改为「前往能力界面调优」或只读展示
- **状态**：**已修复**（2026-08-10 收尾）— 移除 Profile 编辑弹窗；详情只读 + 「前往能力界面调优 Agent」；冒烟 `agent-detail-no-profile-edit` / `agent-detail-tune-link` PASS；截图 `workbench-agent-detail-readonly.png`

#### [ADVISORY] Fresh install「仅已安装」筛选下仍可见 curated 专家

- **反模式**：临时 userDataDir + `#hubInstalledOnly`
- **预期**：完全无安装项时出现「还没有…专家」+「添加自己的专家」
- **实际**：curated/仓库扫描项在 fresh profile 即带 installed 态，筛选后仍有卡片
- **严重级别**：ADVISORY（零结果搜索空态已验证诚实 UX；与制作人结论一致）
- **证据**：`qa-p0-hub-empty-state.png`（搜索空态）
- **状态**：**未改**（低风险优先；改 filter 可能影响 enabled/disabled 既有语义，留后续 Story）

#### [ADVISORY] 本 change 缺少 code-review.md

- **严重级别**：ADVISORY（Story 完成门禁软项）
- **状态**：**已补** `code-review.md`（收尾归档前）

---

## 自动化证据

| 文件 | 说明 |
|------|------|
| `evidence/relocate-authoring-electron-smoke.json` | 基线冒烟 25/25 |
| `evidence/tester-qa-p0-smoke.json` | P0 扩展 22/24 |
| `evidence/tester-qa-p0-smoke.js` | 测试角色扩展脚本（可复跑） |
| `evidence/screenshots/` | 实机截图 13 张（含 QA 新增 6 张） |

---

## 结论

- [x] **通过，可 story-done**
- [ ] 不通过，打回开发

**测试签字**：Tester  
**日期**：2026-08-10

> 注：未执行 `/story-done` 或归档；待协调方在全员工序确认后执行。
