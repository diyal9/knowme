# 测试报告: consolidate-capability-hub-entry

- **日期**：2026-08-04
- **测试角色**：Tester（正式 QA）
- **前置**：开发自测 PASS + 制作人验收 PASS（`acceptance.md`）
- **Change**：rail 三入口收敛为单一「能力」；Hub 页内 Tab（专家 / 技能 / MCP 连接器）

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | QA 本轮实测（Playwright 静态 HTTP 预览 / 脚本 / 门禁） |
| 📋 | 契约或代码走查 + 既有自动化（未做真机交互） |
| ⚡ | 继承 dev-self-test Electron 冒烟（QA 未重复手测） |
| ⏭ | 本轮未测（需真机或超出本 Story 范围） |

---

## 门禁

| 级别 | 检查项 | 结果 | 说明 |
|------|--------|------|------|
| 硬 | `npm run harness:gate` | **PASS** | blocking=false；test + lint 均绿 |
| 硬 | `npm test` | **PASS** | 885/885（QA 复跑） |
| 硬 | `npm run lint` | **PASS** | harness:gate 内含 |
| 软 | qa-plan Smoke Scope | **已执行** | 见下表；真机会话项标注 ⏭/⚡ |
| 软 | code-review.md | **已完成** | 无 BLOCKING |

---

## Smoke 结果

### Rail 统一入口

| 用例 | 结果 | 证据 |
|------|------|------|
| rail 能力区仅一个「能力」图标 | ✅ PASS | Playwright `workspace.html`：仅 `#btnRailCapabilities`；legacy 三 id 不存在 |
| tooltip `title="能力"` + aria-label 含「专家、技能与 MCP 连接器」 | ✅ PASS | DOM 属性断言 + `workspace-capability-rail.test.js` |
| 点击打开 Hub overlay，rail active/pressed | ✅ PASS | 静态预览：`aria-pressed=true`、`active`、iframe `tab=experts` |
| 再次点击 toggle 关闭 | ✅ PASS | 静态预览：第二次点击后 `drawer.open=false`、`aria-pressed=false` |

### Hub 页内 Tab

| 用例 | 结果 | 证据 |
|------|------|------|
| 默认「专家」Tab + 专家卡片/chips | ✅ PASS | `hub-experts-tab.png`；MOCK 卡片「办公搭档」等 |
| 「技能」Tab 同页切换 | ✅ PASS | 快速切换 9 轮无 mismatch；chips 变为「写作/飞书/…」 |
| 「MCP 连接器」Tab + 文案 | ✅ PASS | Tab 文本「MCP 连接器」；卡片「飞书连接器」等 |
| aria-selected 与内容一致 | ✅ PASS | 深链 `?tab=connectors`：`aria-selected="true"` + activeTab=connectors |

### 深链与入口

| 用例 | 结果 | 证据 |
|------|------|------|
| Agent 空态 CTA → 技能 Tab | 📋 PASS | `data-capability-hub="skills"` + `workspace-agent.js` 调用 `openCapabilityHub`；静态 `openCapabilityHub('skills')` iframe PASS |
| 设置页「打开能力 Hub」 | 📋 PASS | `settings.html` postMessage `{ type:'open-capability-hub', tab:'skills' }`；文案已改为「能力 Hub / MCP 连接器」（无「技能图标」） |
| Hub 已开时深链切换 Tab 不叠层 | ✅ PASS | 静态：`openCapabilityHub('connectors')` 仅 1 个 iframe，`src` 更新为 connectors |

### 关闭与会话

| 用例 | 结果 | 证据 |
|------|------|------|
| Esc / `capability-hub-close` 关闭 overlay | ✅ PASS | Playwright workspace：Esc 与 close 消息后 `drawer.open=false` |
| 关闭后 Agent 消息/草稿/Session Tab 保留 | ⚡ PASS | QA 未真机复测；`closeDrawer` 不卸载 agent iframe（code-review）；Electron 冒烟无 uncaught error |
| 开→切 Tab→关→再开，Agent 会话完整 | ⚡ PASS | 同上；Hub 重开默认 experts（spec 预期） |

### 回归冒烟

| 用例 | 结果 | 证据 |
|------|------|------|
| 搜索 / chip /「已安装」三 Tab 各一条 | ✅ PASS | experts 搜索「办公」→1 卡；skills chip「飞书」→1 卡；connectors「已安装」→1 卡 |
| 详情抽屉 + Tab 切换无 JS 报错 | ✅ PASS | 开抽屉后连切 Tab：`errors=[]` |
| `npm test` / lint | ✅ PASS | harness:gate |

---

## Regression Scope

| 用例 | 结果 | 说明 |
|------|------|------|
| 安装/启用/禁用/卸载生命周期 | ⏭ 继承 | 本 Story 未改 `capability-hub-service` / IPC；`capability-integration.test.js` 随全量 885 PASS |
| `/slash` 与上下文注入 | ⏭ 继承 | 无相关源码变更；全量测试 PASS |
| 连接器 health / allowlist / MCP 投影 | ⏭ 继承 | 同上 |
| rail 切换与 Hub overlay 不串态 | ✅ PASS | Hub 打开时点击「工作台」rail：`drawerOpen=false`，能力按钮失活 |
| 知识库/设置 overlay 与 Hub 互斥 | ✅ PASS | Hub 打开后点「设置」：`drawer-settings` 替换 Hub，iframe 移除 |

---

## 反模式探索

| 反模式 | 结果 | 备注 |
|--------|------|------|
| 快速连切三 Tab，卡片/chips 不串 | ✅ PASS | 9 次 rapid switch，`mismatches=[]` |
| 720px / 1280px Tab 可读可点 | ✅ PASS | 720px：三 Tab 可见宽 52/52/93px，`headerOverflow=false`；见 `hub-connectors-720.png` / `1280.png` |
| Hub 开时切 rail，无空白 overlay | ✅ PASS | 切工作台 rail 后 overlay 关闭 |
| 技能 Tab 开抽屉再切 Tab | ✅ PASS | 无 uncaught error |
| 深链 `?tab=connectors` 显示「MCP 连接器」 | ✅ PASS | URL + activeText 断言 |
| 设置页仍写「技能图标」 | ✅ PASS | 全库 `src/` 无「技能图标」残留 |

### ADVISORY（不阻塞 story-done）

| 级别 | 标题 | 说明 |
|------|------|------|
| ADVISORY | Hub Tab 窄窗略挤 | 720px 下「MCP 连接器」Tab 宽约 93px，仍可读可点；无专用 header 断点（acceptance 已预警） |
| ADVISORY | Hub 不记忆上次 Tab | rail 再开始终 experts；符合 spec |
| ADVISORY | Tab 键盘 / tabpanel a11y | 既有缺口，非本 change 引入（code-review） |
| ADVISORY | Agent 会话保留未 QA 真机手测 | 依赖 Electron 冒烟 + 代码走查；建议后续 spot-check |

**BLOCKING**：无。

---

## 截图证据

| 文件 | 说明 |
|------|------|
| `screenshots/hub-experts-tab.png` | Hub 默认专家 Tab |
| `screenshots/hub-connectors-1280.png` | MCP 连接器 Tab @1280px |
| `screenshots/hub-connectors-720.png` | MCP 连接器 Tab @720px（窄窗反模式） |
| `screenshots/workspace-rail-hub-open.png` | 单入口 rail + Hub overlay |

---

## 已知限制（不记为失败）

- 浏览器静态 `workspace.html` 缺少 Electron preload，控制台有既有 `onWorkspaceRefresh` 等错误；**不属于本 change**，真机 Electron 无此类报错（dev-self-test）。
- Playwright **不能**替代 Electron 壳；会话保留、空态 CTA 点击等以 ⚡/📋 标注，未伪装为 QA 真机手测。

---

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**总评**：**PASS** — 用户核心诉求（专家/技能/MCP 连接器同一 Hub、Tab 同页切换、rail 单入口 toggle、深链、overlay 互斥）均已通过 QA 可执行项验证；硬门禁全绿；无 BLOCKING。ADVISORY 项可后续 Story 跟进。

**测试人**：Tester  
**日期**：2026-08-04
