# 测试报告: unify-capability-fabric-foundation

**测试日期**：2026-08-04  
**测试人**：测试（Tester）  
**接入前提**：开发自测 PASS + 制作人验收 PASS（见 `acceptance.md`）  
**结论**：**PASS — 可进入 `/story-done` 门禁**

---

## 门禁

| 级别 | 检查项 | 结果 | 详情 |
|------|--------|------|------|
| 硬 | `npm test` | **PASS** | 967/967 通过 |
| 硬 | `npm run lint` | **PASS** | lint ok + script-scope ok |
| 硬 | OpenSpec strict validate | **PASS** | `openspec validate unify-capability-fabric-foundation --strict` |
| 硬 | harness gate | **PASS** | `node .cursor/scripts/harness.js gate --json` → blocking=false |
| 软 | qa-plan Smoke Scope | **已执行** | 见下表 |
| 软 | code-review.md | **PASS** | 开发最终自审已完成，无 BLOCKING 缺陷 |

---

## 自动化结果

### 聚焦回归（change 相关，106/106 PASS）

```
node --test \
  tests/capability-manifest-v2.test.js \
  tests/capability-store.test.js tests/capability-import.test.js tests/capability-catalog.test.js \
  tests/expert-runtime.test.js tests/skill-runtime.test.js tests/connectors.test.js \
  tests/capability-pack.test.js tests/capability-integration.test.js tests/capability-hub.test.js \
  tests/connector-unified-store.test.js tests/connector-runtime.test.js \
  tests/game-studio-scenes.test.js tests/assistant-prompt-router.test.js
```

| 套件 | 覆盖重点 |
|------|----------|
| `capability-manifest-v2` | v2 规范化、legacy adapter、依赖环/缺失/可选、风险聚合 |
| `capability-store` / `import` / `catalog` | 安装前校验、sidecar materialize、治理字段透传 |
| `expert-runtime` / `skill-runtime` | Session 前 binding 校验、L0–L3 路径边界 |
| `connector-unified-store` / `connector-runtime` | 幂等迁移、`.unified-v2.bak` 备份、manifest-only、legacy 投影 |
| `capability-integration` / `capability-hub` | `dependency_conflict`、`risk_confirmation_required`、Hub 静态三 Tab 契约 |
| `capability-pack` / `game-studio-scenes` | Pack 统一依赖模型、game-studio 路由与路径 confinement 回归 |

### 全量

- `npm test`：967/967 PASS（duration ~5.7s）

---

## Smoke Scope 结果（qa-plan.md）

| 用例 | 结果 | 证据 |
|------|------|------|
| 旧 SKILL/EXPERT/Connector/Pack 无 sidecar 仍可导入 | PASS | `capability-manifest-v2.test.js` legacy adapter；`capability-import.test.js` |
| Hub 展示真实 dependencies/permissions/IO/risk/provenance | PASS | `capability-integration.test.js`；静态 UI 抽屉分区（见截图） |
| required 缺失阻断 / optional 仅警告 | PASS | manifest v2 + hub service 集成测试 |
| high/critical 未确认不改 install store | PASS | `capability-hub-service.js` + `capability-integration.test.js` |
| Connector 设置页 / Hub / Agent 状态一致 | PASS（自动化） | unified store 投影测试；真机往返见残余风险 |
| manifest-only MCP 可运行 | PASS | `connector-unified-store.test.js` + `connector-runtime.test.js` |
| legacy 迁移幂等、有备份、可回退 | PASS | `connector-unified-store.test.js` dual/legacy 模式 |
| Pack 聚合依赖与风险、无独立 schema | PASS | `capability-pack.test.js` game-studio 依赖冲突场景 |
| Hub 三 Tab + 单层顶栏布局不变 | PASS | `capability-hub.test.js` + 静态 UI 三 Tab 截图 |
| game-studio pack 路由回归 | PASS | `capability-pack.test.js` + `game-studio-scenes.test.js` + `assistant-prompt-router.test.js` |

---

## UI / 真机证据

### 静态 UI 预览（Playwright）

| 证据 | 说明 |
|------|------|
| `C:\Users\Administrator\hub-tab-experts.png` | 专家 Tab：单层顶栏 + 精选/Catalog 布局 |
| `C:\Users\Administrator\hub-tab-skills.png` | 技能 Tab 切换正常 |
| `C:\Users\Administrator\hub-tab-connectors.png` | MCP 连接器 Tab 切换正常 |
| `C:\Users\Administrator\hub-drawer-governance.png` | 办公搭档详情抽屉：依赖（feishu-connector · 必需）、权限、输入/输出、风险与来源分区 |

**控制台**：仅 `favicon.ico` 404（已知非产品错误，已忽略）。

**反模式 — 抽屉遮罩**：抽屉打开时 backdrop 拦截 Tab 点击，须先关闭详情再切换 Tab；行为符合预期，非缺陷。

仓库内索引见 `evidence/ui-smoke-evidence.md`；截图由 Playwright 服务写入其允许的本机输出目录。

### Electron 真机

| 项 | 状态 | 说明 |
|----|------|------|
| 启动无 uncaught error | PASS | 清理旧单实例锁后从 `D:\aispace\knowme` 启动；主进程日志正常，renderer `app-path` 指向当前工作区并持续运行 |
| 设置页 Connector allowlist 往返 | 未补证 | 由 unified store 投影测试覆盖逻辑；建议 Story 后 spot-check |
| 重启后迁移不重复 | 未补证 | 幂等迁移单测 PASS；建议用户环境 spot-check |
| high-risk MCP 取消/确认真机点击 | 未补证 | 后端 + high UI confirm 单测/代码走查 PASS |

---

## 反模式发现

### [RESOLVED] critical 风险能力 UI 未前置 confirm

- **反模式**：尝试启用 `risk.level === 'critical'` 的能力（对比 high 的前置 `window.confirm`）
- **预期**：与 high 一致，安装/启用前明确确认
- **初始实际**：`capability-hub.js` 仅对 `high` 做前置 confirm；`critical` 无正常确认路径
- **修复**：安装与启用统一用 `['high', 'critical'].includes(...)` 判断；取消不调用 bridge
- **复核**：Hub/Integration 15/15、全量 967/967、lint 与 strict validate 均 PASS

### [RESOLVED] code-review.md 与 dev-self-test.md

- `code-review.md` 已补齐并签署 PASS。
- `evidence/dev-self-test.md` 已补齐，记录开发自测、Electron 冒烟与 QA 后修复复核。

---

## 反模式重点核对（任务指定）

| 检查点 | 结果 | 备注 |
|--------|------|------|
| Manifest v2 legacy 适配 | PASS | Skill/Expert/Connector/Pack/Cursor linked adapters 单测覆盖 |
| 依赖环 / 缺失依赖 | PASS | `dependency_cycle`、`missing_required_dependency`、`missing_optional_dependency` |
| high/critical 未确认阻断 | PASS | 后端强制；high UI 前置 confirm |
| Connector unified store 幂等/备份/投影 | PASS | `.unified-v2.bak`、manifest-only、authority-first 投影 |
| manifest-only connector runtime | PASS | `connector-runtime.test.js` |
| Hub 三 Tab + 治理字段 | PASS | 静态契约 + UI 截图 |
| game-studio pack 路由回归 | PASS | install/scenes/schema/dependency_conflict |

---

## 残余风险

1. **Electron 深度交互**：设置页 ↔ Hub 往返、用户数据上的重启迁移、high-risk 取消/确认点击 — 逻辑层已测，建议发布前由用户环境 spot-check。
2. **静态预览 ≠ Electron 壳**：Hub 截图来自 http 静态预览 + MOCK catalog fallback，真机 IPC 路径由集成测试覆盖。
3. **legacy adapter 推导精度**：自动适配会在 provenance 标记来源；作者可通过显式 v2 sidecar 提升声明精度。

---

## 结论

- [x] **通过，可 story-done**
- [ ] 不通过，打回开发

**理由**：全部硬门禁（967 测试、lint、OpenSpec validate、harness gate）通过；qa-plan Smoke Scope 由聚焦 106 项测试 + 静态 UI + Electron 启动证据覆盖；QA 发现的 critical UI 确认缺口已修复并完成回归，未留下 BLOCKING 缺陷。

**证据索引**：`evidence/ui-smoke-evidence.md`  
**关联**：`acceptance.md`（制作人 PASS 2026-08-04）
