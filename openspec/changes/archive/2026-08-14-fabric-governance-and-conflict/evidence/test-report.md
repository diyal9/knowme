# Test Report · fabric-governance-and-conflict（Tester 正式 QA）

**角色**：测试（Tester）  
**日期**：2026-08-08  
**判定**：**有条件通过**（治理功能闭环 OK；S5 存在 pageerror，归因并行工作台重构，非本 change 核心逻辑）

---

## 任务 A · 门禁阻塞核实（workbench-templates 5 项失败）

### 结论：**既有 / 并行工作台重构债务 — 可豁免，非 `fabric-governance-and-conflict` 回归**

### 证据

| 项 | 结果 |
|---|---|
| 全量 `npm test`（QA 会话初） | **1479 / 1484 PASS**，5 FAIL 均在 `tests/workbench-templates.test.js`（goal-first HTML 断言） |
| 全量 `npm test`（QA 结束时） | **1487 / 1488 PASS**，1 FAIL：`matches the daemon primary and advanced workflow catalog`（workbench.js 目录过滤逻辑） |
| 单独跑该文件（结束时） | **39 pass / 1 fail** |
| Fabric 相关子集 | `fabric-governance` 10/10、`fabric-knowledge-runtime` 8/8、`center-surface-tabs` 4/4 — 全绿 |
| `git diff HEAD -- tests/workbench-templates.test.js` | 测试从 HEAD 旧断言（`选择工作流`、`懂你的智能体团队`）**改写**为 goal-first 断言（`今天想完成什么`、`wb-goal-hero`、`wbTabHome>开始` 等） |
| HEAD 版测试 + 当前 HTML | **15 pass / 12 fail** — 说明 HTML/JS 与两套断言均不同步，债务早于本 change |
| `git diff HEAD --stat` | `tests/workbench-templates.test.js` +271 行；`src/workspace.html` +1913 行 — **工作台重构**，与 fabric 治理无直接关联 |
| `git diff HEAD -- src/main.js src/preload.js src/workspace.js` | 主要为 fabric IPC / 治理 Tab；**未改** goal-hero / wb-advanced-menu 等失败断言涉及的 HTML |
| 5 个失败根因 | 静态 HTML 缺少测试期望 markup：`今天想完成什么`、`class="wb-goal-hero"`、`class="wb-advanced-menu"`、`wbTabHome` 文案为「总览」非「开始」等 |

### 5 个失败用例（QA 会话初独立复现）

当时 `workbench-templates.test.js` 含 goal-first 断言，5 项均因 **HTML markup 未同步** 失败（与 fabric 无关）：

1. `provides the template region and responsive card styles` — 缺 `今天想完成什么`
2. `uses flat accessible page tabs with an active underline` — Tab 文案/结构不匹配
3. `presents the workbench entrance as one refined welcome card` — 缺 goal-first 文案
4. `keeps the advanced mode menu fully visible and keyboard reachable` — 缺 `wb-advanced-menu` HTML
5. `uses goal-first entry and keeps modes as advanced context` — 缺 `wb-goal-hero`

**QA 结束时** 该文件已演进，全量门禁变为 **1 项失败**：`matches the daemon primary and advanced workflow catalog` — 断言 `workbench.js` 内 `primary: list.filter(...visibility === 'primary')` 模式，属 **Daemon 工作流目录** 并行重构，仍与 fabric 治理无交集。

**与 fabric-governance / 织网 / 治理 Tab 无代码路径交集。**

---

## 任务 B · P4 功能与体验 QA

### Smoke S1–S5

| # | 场景 | 判定 | 证据 |
|---|------|------|------|
| S1 | 治理 Tab 空状态 | ✅ | `#govRunCheckup`、`#govSsotMode`、空态文案「尚未运行体检…」 |
| S2 | 联合体检 | ✅ | 健康分 80%、分类 chips、问题列表 ≥1 |
| S3 | 行动项（忽略） | ✅ | 忽略后列表减少，按钮恢复 |
| S4 | SSOT mark↔block | ✅ | 下拉切 block → toast「已更新 SSOT 策略」；单测 block 拒绝重复 ingest |
| S5 | 控制台 0 报错 | ⚠️ **FAIL** | `pageerror: Identifier 'api' has already been declared`（见下方 Major-1） |

### 扩展场景（Tester 独立 Electron）

脚本：`evidence/tester-fabric-governance-electron-qa.js`  
报告：`evidence/tester-fabric-governance-electron-qa.json`  
**9 / 10 检查通过**（仅 S5-console-clean 失败）

| 检查项 | 结果 |
|--------|------|
| 断锚 / stale / 冲突分类 | ✅ Wiki 体检、悬空锚点、概念冲突 |
| 冲突回流 | ✅ 治理面板可见「冲突」 |
| 织网按钮恢复 | ✅ `#fabricWeaveRun` 恢复「织入当前库」 |
| 检索回归 | ✅ 命中 ≥1，按钮恢复「检索」 |
| 窄屏治理 Tab | ✅ 720px 无横向溢出 |

开发冒烟（对照）：`fabric-governance-electron-smoke.js` **4/4 PASS** — 但仅监听 `console.error`，**未捕获 pageerror**（测试盲区）。

### 单元 / Lint

| 命令 | 结果 |
|------|------|
| `npm run lint` | PASS |
| `tests/fabric-governance.test.js` | 10/10 |
| `tests/fabric-knowledge-runtime.test.js` | 8/8 |
| `tests/center-surface-tabs.test.js` | 4/4 |

---

## 分级问题清单

### Major-1 · 启动即 pageerror（S5 严格不通过）

- **复现**：启动 Electron → 加载 `workspace.html` 即触发；无需打开知识库
- **期望**：0 console / page error
- **实际**：`pageerror: Identifier 'api' has already been declared`
- **归因**：并行工作台重构引入 `src/lib/workbench-console-model.js`（未跟踪新文件）顶层 `const api`，与经典脚本共享词法作用域冲突（同文件 `agent-presence.js` 注释已警告须唯一命名）。**非 `fabric-governance.js` / 治理 Tab 引入**
- **证据**：独立最小复现脚本；frame URL 为 `workspace.html`；dev 冒烟未监听 pageerror

### Minor-1 · 开发冒烟未覆盖 pageerror

- **复现**：仅跑 `fabric-governance-electron-smoke.js`
- **期望**：与 qa-plan S5 等价
- **实际**：`console-clean` 通过但 pageerror 存在
- **建议**：冒烟脚本增加 `page.on('pageerror')` 监听

### Advisory-1 · workbench-templates 5 项（见任务 A）

- 测试断言领先于 HTML，需在独立工作台 Story 修复，不应阻塞 fabric-governance 功能验收

### Advisory-2 · 重织队列 UI 未在 Electron 深度手测

- 单测 `enqueue and process reweave queue` 10/10 通过；治理面板 `#govProcessReweave` 未在本次扩展脚本中单独断言（非 blocking）

---

## 验收标准对照（proposal.md）

| # | 标准 | 判定 |
|---|------|------|
| 1 | SSOT mark/block + 提案 | ✅ 单测 + SSOT 下拉 + block toast |
| 2 | 断锚/stale + 重织队列 | ✅ 单测 + 体检分类含悬空/stale |
| 3 | 联合体检聚合 | ✅ 健康分 + Wiki/冲突/重复 |
| 4 | 治理 Tab 闭环 + 0 报错 | ⚠️ 闭环 ✅；**pageerror 不满足严格 0 报错**（并行工作台债务） |

---

## 截图

| 文件 | 说明 |
|------|------|
| `screenshots/governance-checkup.png` | 开发冒烟 · 体检结果 |
| `screenshots/governance-after-action.png` | 开发冒烟 · 忽略行动后 |
| `screenshots/tester-governance-empty.png` | Tester · 治理空状态 |
| `screenshots/tester-governance-checkup.png` | Tester · 体检报告 |
| `screenshots/tester-governance-narrow.png` | Tester · 窄屏治理 Tab |

---

## `/story-done` 建议

| Change | 建议 |
|--------|------|
| `establish-root-knowledge-fabric` | 前序 QA 已通过；本轮织网/检索回归未破坏 |
| `fabric-governance-and-conflict` | **可有条件进入 `/story-done`**：治理交付物与 Smoke S1–S4、回归织网/检索均 OK |
| 硬门禁 `npm test` | 会话初 1479/1484；结束时 **1487/1488**；workbench-templates **建议豁免**（任务 A 证据） |
| 跟进 | Major-1 pageerror 应在**工作台重构** Story 修复（`workbench-console-model.js` 重命名导出，与 `agentPresenceApi` 模式一致）；修复前勿宣称全局「控制台 0 报错」 |

---

## 复现命令

```bash
npm test
npm run lint
node --test tests/fabric-governance.test.js
node openspec/changes/fabric-governance-and-conflict/evidence/fabric-governance-electron-smoke.js
node openspec/changes/fabric-governance-and-conflict/evidence/tester-fabric-governance-electron-qa.js
node --test tests/workbench-templates.test.js
```
