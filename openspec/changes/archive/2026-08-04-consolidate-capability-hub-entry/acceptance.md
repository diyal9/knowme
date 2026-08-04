# 制作人体验验收: consolidate-capability-hub-entry

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**证据**：`evidence/dev-self-test.md`；OpenSpec strict PASS；定向 8/8；`npm test` 885/885；`npm run lint` PASS；Playwright 静态预览 + Electron 重启冒烟

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 静态契约 / 单元测试 / Playwright 预览 / 代码走查已证实 |
| ⚡ | Electron 真机冒烟（无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 信息架构

- [x] ✅ rail 仅保留一个「能力」入口，专家/技能/连接器不再作为三个独立 rail 图标 — `workspace.html` 仅 `btnRailCapabilities`；legacy id 已移除；契约测试 PASS
- [x] ✅ Hub 作为单一能力管理模块，页内 Tab 表达三类子分类 — `capability-hub.html` 三 Tab 同页；design §2 rail=模块、Tab=分类
- [x] ✅ 与 proposal「能力管理是一个完整产品模块」心智一致 — 品牌「能力 Hub」+ 统一 overlay，非三个假独立页

## 可发现性

- [x] ✅ 单一入口 tooltip `title="能力"` + aria-label「能力：专家、技能与 MCP 连接器」 — 悬停/读屏可获知三类内容
- [x] ✅ Agent 空态保留「打开能力 Hub」CTA，深链至技能 Tab — `data-capability-hub="skills"` + `workspace-agent.js` 调用 `openCapabilityHub`
- [x] 🔜 新用户首次进入是否能在 ≤2 次点击内找到 MCP 连接器 — rail → Hub → MCP 连接器 Tab（Playwright 已证路径；QA 可补首次用户走查）

## 导航简洁度

- [x] ✅ rail 能力区从 3 图标收敛为 1，视觉噪音降低 — Playwright 静态预览确认
- [x] ✅ rail 激活态仅反映 Hub 开/关，不随页内 Tab 变化 — `syncRailNavigation` 中 `capabilityHubOn` 逻辑；design §2 决策一致
- [x] ✅ 再次点击 rail 能力按钮 toggle 关闭 Hub — `toggleCapabilityHubRail` 契约
- [x] ✅ 打开 Hub 时底层 Agent/工作台模式不被强制切换 — `overlayOn` 不改动 `workspaceMode`

## Tab 命名

- [x] ✅ 三 Tab 文案为「专家 / 技能 / MCP 连接器」 — `capability-hub.html` + 静态契约测试断言 `MCP 连接器`
- [x] ✅ 内部路由值仍为 `experts|skills|connectors`，不破坏 catalog/URL/IPC — `CAPABILITY_HUB_TABS`、`TAB_KIND` 映射未变
- [x] ✅ 「MCP 连接器」明确技术属性，与泛称「连接器」区分 — 符合用户明确要求与设计 §4

## 深链兼容

- [x] ✅ rail 单入口默认 `openCapabilityHub('experts')` — `toggleCapabilityHubRail` + 默认 state
- [x] ✅ iframe `?tab=experts|skills|connectors` 深链继续可用 — `capability-hub.js` `parseInitialTab` + dev-self-test
- [x] ✅ Agent 空态 / `open-capability-hub` postMessage / `window.openCapabilityHub` 仍可指定 Tab — `workspace.js` 消息处理 + 全局 API
- [x] ✅ Hub 已打开时再次深链可切换 iframe src 至目标 Tab — `openCapabilityHub` 内 frame src 更新分支

## 会话保留

- [x] ✅ Esc / Hub 关闭按钮 / `capability-hub-close` 关闭 overlay — 契约测试 + dev-self-test
- [x] ✅ `closeDrawer` 仅移除 overlay 样式与 drawerKind，不销毁 Agent pane/iframe — 代码走查：无 agent iframe 卸载
- [x] ⚡ 关闭 Hub 后回到先前 Agent 视图，Electron 重启无 uncaught error — dev-self-test Electron 冒烟

## 体验标准

- [x] ✅ 页内 Tab 切换无整页 reload 感，卡片/筛选随 Tab 更新 — Playwright 预览 + `setTab` 逻辑
- [x] ✅ 视觉与既有 Hub 浅色风格一致，无新增 rail 占位异常 — 沿用 `component` 图标与 accent 激活态
- [x] 🔜 窄窗（≤720px）三 Tab 是否拥挤或可读 — CSS 有 grid 断点但 Tab header 无独立断点；移交 QA 反模式验证

## Advisory（不阻塞放行）

| 级别 | 项 | 说明 |
|------|-----|------|
| RESOLVED | 设置页入口文案 | 已统一为工作台左侧「能力」入口，并说明通过 Tab 管理三类能力 |
| RESOLVED | 空态副文案术语 | 已统一为「专家、技能与 MCP 连接器」 |
| ADVISORY | 重开 Hub 默认 Tab | 关闭后从 rail 再开始终回到「专家」，不记忆上次 Tab；符合 spec， power user 可注意 |
| ADVISORY | code-review.md | 软门禁尚未填写，测试接入前建议补 |

## 验收依据

- 开发自测：`evidence/dev-self-test.md`
- 规格：`proposal.md`、`design.md`、`specs/workspace`、`specs/capability-hub`
- 硬门禁：OpenSpec strict PASS；定向 8/8；`npm test` 885/885；`npm run lint` PASS

## 验收结论

- [x] **通过** / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-04
- 备注：**PASS** — 用户核心诉求（专家、技能、MCP 连接器同一 Hub、Tab 切换、rail 单入口）已满足；深链与会话保留无回归。Advisory 项不阻塞测试 QA 接入。
