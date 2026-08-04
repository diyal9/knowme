# QA Plan: consolidate-capability-hub-entry

## Smoke Scope（必填）

### Rail 统一入口

- [x] 进入 Agent 工作台，左侧 rail 能力区**仅显示一个**「能力」图标（无专家/技能/连接器三个独立按钮） — QA ✅ Playwright + 契约测试
- [x] 悬停 tooltip 为「能力」；读屏 aria-label 含「专家、技能与 MCP 连接器」 — QA ✅
- [x] 点击「能力」打开全屏 Capability Hub overlay，rail 按钮呈 active/pressed — QA ✅
- [x] 再次点击同一 rail 按钮关闭 Hub（toggle 行为） — QA ✅

### Hub 页内 Tab

- [x] Hub 默认激活「专家」Tab，显示专家卡片与分类 chips — QA ✅
- [x] 点击「技能」Tab：同一页面切换，显示技能卡片与对应分类（无整页跳转/闪白） — QA ✅ 快速切换 9 轮无串数据
- [x] 点击「MCP 连接器」Tab：同一页面切换，显示连接器卡片；Tab 文案为「MCP 连接器」而非泛称「连接器」 — QA ✅
- [x] 三 Tab 选中态、aria-selected 与内容类型一致 — QA ✅

### 深链与入口

- [x] Agent 空态「打开能力 Hub」按钮打开 Hub 且默认定位「技能」Tab — 📋 契约 + `openCapabilityHub('skills')` 静态 PASS（空态点击 ⏭ 需 Agent iframe）
- [x] 设置页「打开能力 Hub」按钮可打开 Hub（默认专家 Tab 即可） — 📋 postMessage 契约 + 文案修复 verified（真机按钮 ⏭）
- [x] Hub 已打开时，从空态或其他深链请求不同 Tab，iframe 切换到对应 Tab 且不重复叠层 — QA ✅

### 关闭与会话

- [x] Hub 内 Esc、关闭按钮均可关闭 overlay — QA ✅ Esc + `capability-hub-close` 消息
- [x] 关闭 Hub 后回到关闭前的 Agent 视图；已有对话消息、输入框草稿、Session Tab 均保留 — ⚡ 继承 dev-self-test + 代码走查（QA 未真机手测）
- [x] 打开 Hub → 切换 Tab → 关闭 → 再打开：Agent 会话仍完整（不要求记忆 Hub 内 Tab） — ⚡ 同上

### 回归冒烟

- [x] Hub 搜索、分类 chip、「已安装」筛选在三 Tab 下仍可用（各测一条） — QA ✅
- [x] 详情抽屉打开/关闭不因 Tab 切换崩溃 — QA ✅ 无 JS error
- [x] `npm test` 全通过（含 `workspace-capability-rail.test.js`、`capability-hub.test.js`） — QA ✅ 885/885
- [x] `npm run lint` 无 error — QA ✅ harness:gate

## Regression Scope

- [x] agent-capability-hub 既有能力：安装/启用/禁用/卸载生命周期不退化 — ⏭ 继承全量测试（本 Story 未改 runtime）
- [x] `/slash` 技能列表与 Agent 上下文注入不退化 — ⏭ 继承全量测试
- [x] 连接器 health、allowlist、MCP 工具投影不退化 — ⏭ 继承全量测试
- [x] 工作台 / 自动化 rail 切换与 Hub overlay 互不串态 — QA ✅
- [x] 知识库、设置 overlay 与能力 Hub overlay 互斥行为正常 — QA ✅ Hub→设置互斥

## Anti-pattern Checks（交给测试）

- [x] 快速连续切换 Hub 三 Tab，卡片/筛选/chips 不串类型 — QA ✅
- [x] 窄窗（720px / 1280px）Hub header 三 Tab 可读、可点，不被搜索框挤没 — QA ✅（720px 略挤 ADVISORY）
- [x] Hub 打开时切换 rail 至 Agent/工作台，Hub 应关闭或行为符合预期（无空白 overlay） — QA ✅
- [x] 从技能 Tab 打开详情抽屉后切换 Tab，抽屉状态不导致 JS 报错 — QA ✅
- [x] 深链 `?tab=connectors` 直接打开时，第三个 Tab 文案显示「MCP 连接器」 — QA ✅
- [x] 设置页文案若仍提及「技能图标」，记录为文案缺陷（非本 change 阻塞项） — QA ✅ 已修复，无残留

## 证据要求

| 产物 | 路径 |
|------|------|
| 开发自测 | `evidence/dev-self-test.md` |
| UI 截图 | `evidence/screenshots/`（rail 单入口、Hub 三 Tab） |
| 测试报告 | `evidence/test-report.md` |
| 代码审查 | `code-review.md`（软项） |
| 制作人验收 | `acceptance.md` |

## 门禁

- [x] `/gate-check` 或 `npm run harness:gate` → `ok=true`, `blocking=false` — QA ✅ 2026-08-04
