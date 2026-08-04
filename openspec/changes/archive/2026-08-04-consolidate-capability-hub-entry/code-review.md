# Code Review: consolidate-capability-hub-entry

- 日期：2026-08-04
- 审查者：开发（Developer）
- 审查范围：rail 三入口收敛为 `btnRailCapabilities`、Hub 页内 Tab、深链兼容、文案与无障碍、IPC/runtime 边界、测试契约
- 对照工件：`proposal.md`、`design.md`、`specs/workspace/spec.md`、`specs/capability-hub/spec.md`、`tasks.md`、`acceptance.md`
- 结论：**通过（无 BLOCKING）** — 实现与 OpenSpec 一致，硬门禁全绿；可进入测试 QA 接入

## 变更范围

| 文件 | 变更性质 |
|------|----------|
| `src/workspace.html` | rail DOM：`btnRailCapabilities` 替换三按钮；激活态 CSS；`rail-capabilities` 分区 |
| `src/workspace.js` | `openCapabilityHub` / `toggleCapabilityHubRail`；`syncRailNavigation` 收敛；postMessage 深链 |
| `src/capability-hub.html` | 第三 Tab 文案「MCP 连接器」；Tab 默认 `experts` |
| `tests/workspace-capability-rail.test.js` | 单入口 + legacy id 移除 + 默认 experts 契约 |
| `tests/capability-hub.test.js` | MCP 文案 + experts 默认 Tab 断言 |

**未触及（符合 Non-goals）**：`src/main.js`、`src/preload.js`、`src/lib/capability-hub-service.js`、`capability-hub.js` 业务/runtime 逻辑（Hub JS 仅既有 Tab 切换与 parent 同步，无 catalog/IPC 变更）。

## Spec 对照

| 要求 | 实现 | 状态 |
|------|------|------|
| rail 仅一个「能力」入口 | `#btnRailCapabilities` + `rail-capabilities`；`btnRailExperts/Skills/Connectors` 全库无残留 | ✅ |
| 点击打开 Hub，默认「专家」Tab | `toggleCapabilityHubRail` → `openCapabilityHub('experts')`；`capabilityHubTab` / `parseInitialTab` 默认 `experts` | ✅ |
| 页内三 Tab 同页切换 | `capability-hub.js` `setTab` + `renderTabs`；不重建 iframe | ✅ |
| rail 激活态只反映 Hub 开/关 | `capabilityHubOn = drawerKind === 'capability-hub' && drawer.open`；不读 `capabilityHubTab` | ✅ |
| rail 再次点击 toggle 关闭 | `toggleCapabilityHubRail` 开→关分支 | ✅ |
| 深链保留 `openCapabilityHub(tab)` | `window.openCapabilityHub`；`?tab=`；`open-capability-hub` postMessage；`data-capability-hub` | ✅ |
| 第三 Tab「MCP 连接器」，路由仍 `connectors` | HTML 文案 + `data-tab="connectors"` + `CAPABILITY_HUB_TABS` | ✅ |
| 关闭 Hub 保留 Agent 会话 | `closeDrawer` 仅清 overlay/drawerKind；Esc / `capability-hub-close` 不变 | ✅ |
| 不新增 IPC / 依赖 | 渲染层 postMessage + iframe src；capability IPC 未改 | ✅ |

## 重点审查

### 1. Rail 三按钮收敛 → `btnRailCapabilities`

- `workspace.html` 在 `rail-capabilities` 工具栏内仅保留一个按钮，`data-icon="component"`，与 design §2 组合图标决策一致。
- 全仓库检索 `btnRailExperts` / `btnRailSkills` / `btnRailConnectors`：仅测试断言「已移除」，源码无残留 id 或事件绑定。
- CSS 激活态：`#btnRailCapabilities.active` 在普通与 `mode-center-surface` 下均使用 accent 色，与其他 rail 按钮模式一致。

### 2. 激活态 / Toggle

```javascript
// syncRailNavigation — 仅 Hub overlay 开关联动
capabilitiesBtn?.classList.toggle('active', capabilityHubOn)
capabilitiesBtn?.setAttribute('aria-pressed', capabilityHubOn ? 'true' : 'false')

// toggleCapabilityHubRail — 开→关 / 关→开（默认 experts）
if (drawerKind === 'capability-hub' && drawer.classList.contains('open')) closeDrawer()
else openCapabilityHub('experts')
```

- Hub 页内 Tab 切换时通过 `capability-hub-tab` 更新 `capabilityHubTab`，但 **不** 改变 rail `active`——符合 design「rail=模块、Tab=分类」。
- 关闭后从 rail 再开始终回到「专家」Tab，不记忆上次 Tab——与 spec 一致（acceptance 已记为预期行为）。

### 3. 默认 experts

| 入口 | 默认 Tab |
|------|----------|
| rail 单按钮 | `'experts'`（`toggleCapabilityHubRail`） |
| `openCapabilityHub()` 无参 | `'experts'`（参数默认 + 非法值回退） |
| `capability-hub.html` 静态默认 | `experts` `aria-selected="true"` |
| `capability-hub.js` boot | `parseInitialTab()` 无 query 时 `'experts'` |

### 4. 深链 `openCapabilityHub(tab)`

| 调用方 | 机制 | Tab 示例 |
|--------|------|----------|
| `window.openCapabilityHub` | 全局 API | 任意合法 tab |
| Agent 空态 CTA | `data-capability-hub="skills"` → `workspace-agent.js` | `skills` |
| 设置页 | `postMessage({ type: 'open-capability-hub', tab: 'skills' })` | `skills` |
| iframe 初始加载 | `capability-hub.html?embedded=1&tab=` | URL query |
| Hub 已开 + 不同 tab 深链 | 更新 `frame.src` 触发 iframe 重载 | 目标 tab |

- `CAPABILITY_HUB_TABS = new Set(['experts','skills','connectors'])` 统一校验，非法值回退 `experts`。
- **注意**：Hub 已打开时跨 Tab 深链走 iframe `src` 重载，与页内 `setTab`（无 reload）路径不同；深链场景可接受，但会丢失 Hub 内未提交的搜索/对话框状态（见 ADVISORY）。

### 5. Hub 三 Tab 同页切换

- `setTab` → `state.tab` 更新 → `notifyParentTab` → `loadCatalog()` → `render()`；卡片、chips、featured 随 `TAB_KIND` / `TAB_CATEGORIES` 切换。
- 页内切换 **不** 重建父页 iframe，体验与 acceptance「无整页 reload 感」一致。
- `connectors` 路由值未变，`TAB_KIND.connectors → 'connector'`，catalog / runtime kind 契约保持。

### 6. MCP 连接器文案

- Hub Tab 可见文案：**「MCP 连接器」**（`capability-hub.html` L19；`capability-hub.test.js` 静态断言）。
- rail `aria-label`：**「能力：专家、技能与 MCP 连接器」**——术语与 Tab 对齐。
- **不一致（ADVISORY）**：Agent 空态副文案仍为「浏览专家、技能与**连接器**」（`workspace.html` / `workspace-agent.js`），未带「MCP」前缀。

### 7. 无障碍

| 项 | rail `btnRailCapabilities` | Hub Tab |
|----|---------------------------|---------|
| `title` / `aria-label` | ✅ `title="能力"` + 完整 aria-label | Tab 文本可读 |
| `aria-pressed` | ✅ 随 `syncRailNavigation` 同步 | — |
| `role="tablist"` / `role="tab"` | — | ✅ |
| `aria-selected` | — | ✅ `renderTabs` 动态更新 |
| `aria-controls` + `role="tabpanel"` | — | ⚠️ 未实现完整 ARIA Tabs 模式 |
| Tab 键盘 roving `tabindex` / 方向键 | — | ⚠️ 未实现（既有缺口） |
| Hub 关闭 `aria-label` | — | ✅ `#hubBtnClose` |
| Esc 关闭 | ✅ 父页 + Hub 内双层处理 | ✅ |

rail 侧无障碍满足 workspace spec；Hub Tab 具备基础选中语义，但未达到完整 WAI-ARIA Tabs 规范——**非本 change 引入，不阻塞**。

### 8. IPC / Runtime 误改检查

- 本 Story 变更文件限定于渲染层 HTML/JS 与静态测试；**未修改** `capability-hub-service.js`、preload capability 通道、main IPC handler。
- Hub 内 catalog 安装/启用仍经既有 `knowme.capability` / `api.capability*` bridge；`capability-hub.js` diff 范围仅为 Tab 文案/HTML 默认态（若 git 有记录），runtime 逻辑未动。
- 父↔子通信用既有 `postMessage` 类型：`capability-hub-close`、`capability-hub-tab`、`open-capability-hub`——无新 IPC 类型。

### 9. 测试覆盖

| 套件 | 条数 | 覆盖点 |
|------|------|--------|
| `workspace-capability-rail.test.js` | 4 | 单按钮 aria；legacy id 移除；`openCapabilityHub` / iframe / 默认 experts；Esc 关闭 |
| `capability-hub.test.js` | 4 | 三 Tab DOM；**MCP 连接器** 文案；experts 默认；bridge / parent 消息 |
| **合计定向** | **8/8 PASS** | |
| `npm test` | **885/885 PASS** | 无回归 |
| `npm run lint` | **PASS** | |

**缺口（ADVISORY）**：

- 无 `toggleCapabilityHubRail` 函数名 / toggle 分支的显式断言（行为由 dev-self-test + acceptance 走查覆盖）。
- 无 `open-capability-hub` postMessage handler 静态断言。
- 无 Playwright/Electron E2E 验证页内 Tab 点击与窄窗布局（移交 QA）。

## 风险

| 级别 | 项 | 说明 / 建议 |
|------|-----|-------------|
| RESOLVED | 设置页引导文案 | 已改为左侧「能力」入口，并明确通过 Tab 管理 |
| RESOLVED | 空态副文案术语 | 已统一为「MCP 连接器」 |
| ADVISORY | 深链跨 Tab 重载 iframe | Hub 已开时 `openCapabilityHub(otherTab)` 改 `frame.src`，丢失 Hub 内 transient 状态；深链场景可接受 |
| ADVISORY | rail 不记忆上次 Tab | 关闭后再开回到 experts；符合 spec，power user 需知 |
| ADVISORY | 窄窗 Tab header | CSS 无 Tab 专用断点，≤720px 三 Tab + 搜索可能拥挤；QA 反模式验证 |
| ADVISORY | Hub Tab 完整 a11y | 缺 tabpanel / 键盘导航；后续 Story 可补 |
| ADVISORY | 软门禁工件 | 无 `qa-plan.md`（Story 完成前测试角色应补） |

**BLOCKING**：无。

## 测试证据

| 检查 | 结果 | 说明 |
|------|------|------|
| 定向测试 | **8/8 PASS** | `workspace-capability-rail` 4 + `capability-hub` 4 |
| `npm test` | **885/885 PASS** | 审查时独立复跑 |
| `npm run lint` | **PASS** | lint + script-scope |
| 开发自测 | PASS | `evidence/dev-self-test.md` |
| 制作人验收 | PASS | `acceptance.md` 已勾选 |

## 结论与建议

实现严格遵循 proposal / design / delta spec：rail 三入口已完全收敛为 `btnRailCapabilities`；激活态与 toggle 语义正确；默认 experts；既有深链与页内 Tab 切换均可用；MCP 连接器文案已到位；IPC/runtime 未被误改；静态测试契约已更新且全绿。

**建议进入测试 QA 接入**。非阻塞跟进：

1. 窄窗 / Tab 键盘 a11y 由 QA 继续验证
2. 静态测试可选加：`toggleCapabilityHubRail`、`open-capability-hub` 消息分支
