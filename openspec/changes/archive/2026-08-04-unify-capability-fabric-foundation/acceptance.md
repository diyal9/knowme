# 制作人体验验收: unify-capability-fabric-foundation

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**结论**：**PASS — 允许进入正式 QA**

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 静态 UI / 单元·集成测试 / 代码走查已证实 |
| ⚡ | Electron 启动冒烟（无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 评估维度

### 用户价值

- [x] ✅ Hub 详情抽屉展示真实治理元数据（依赖、权限、输入/输出、风险、来源证据），不再以空依赖占位 — `capability-hub.js` 抽屉分区 + `capability-integration.test.js` 治理字段透传
- [x] ✅ 旧 SKILL/EXPERT/Connector/Pack 无需 sidecar 仍可导入与启停 — legacy adapter 单元测试 + `capability-manifest-v2.test.js`
- [x] ✅ 用户可在安装/启用前理解能力需要什么、能访问什么、风险来自哪里 — 抽屉「依赖」「权限」「风险与来源」分区；Playwright 静态三 Tab + 抽屉冒烟已验

### 交互一致性

- [x] ✅ 专家 / 技能 / MCP 连接器三 Tab 与单层顶部栏布局不变 — `capability-hub.test.js` 静态契约 + 既有 align-capability-hub-tabs 验收基线
- [x] ✅ 搜索、筛选、精选、目录层级未因治理字段膨胀 — 静态预览与 mock catalog 走查一致
- [x] ✅ 高风险确认沿用原生 `window.confirm`，与信任确认（import trust）交互模式一致 — `capability-hub.js` + `importWithTrust` 重试链

### 风险确认

- [x] ✅ 后端对 `high` / `critical` 未携带 `riskConfirmed=true` 时返回 `risk_confirmation_required`，install store 不变 — `capability-hub-service.js` + `capability-integration.test.js`
- [x] ✅ UI 对 `high` / `critical` 风险安装、启用均前置 confirm；用户拒绝则不提交 — `capability-hub.js` install/toggleEnabled + 静态契约测试

### 依赖阻断

- [x] ✅ 必需依赖缺失时安装/启用返回 `dependency_conflict` 并阻断 — `validateCapabilityActivation` + 集成测试
- [x] ✅ 可选依赖缺失仅警告，不阻断 — manifest v2 `missing_optional_dependency` 测试
- [x] ✅ 抽屉依赖列表区分「必需 / 可选」— 抽屉渲染 `dep.required === false ? ' · 可选' : ' · 必需'`

### 兼容迁移边界

- [x] ✅ Connector unified store：legacy `connectors.json` 幂等迁移、`.unified-v2.bak` 备份、manifest-only 可运行 — `connector-unified-store.test.js`
- [x] ✅ `connectors.json` 保留为兼容投影，legacy fallback 开关存在 — `unified-store.js` dual/legacy 模式
- [x] ✅ v2 sidecar materialize 不破坏旧 store entry；Session 快照与 preload IPC 形状不变 — 集成测试 IPC 25 通道 + preload 契约
- [x] ✅ 非目标未越界：无知识图谱 / Work Graph、无远程 OAuth Gateway / 远程市场、无能力包 Tab、无 Agent executor 重构 — 对照 `proposal.md` Non-goals

---

## Smoke Scope 对照（qa-plan.md）

| 项 | 状态 |
|----|------|
| 旧格式无 sidecar 仍可导入 | ✅ adapter 测试 |
| Hub 展示真实治理字段 | ✅ 集成测试 + Playwright 静态抽屉 |
| required 缺失阻断 / optional 仅警告 | ✅ manifest + hub service 测试 |
| high/critical 未确认不改 store | ✅ 后端强制；high UI confirm |
| Connector 设置页 / Hub / Agent 状态一致 | ✅ unified store 投影测试；🔜 真机设置页往返 QA |
| manifest-only MCP 可运行 | ✅ unified-store 测试 |
| legacy 迁移幂等、有备份、可回退 | ✅ unified-store 测试 |
| Pack 聚合依赖与风险 | ✅ capability-pack 测试 |

---

## 证据

| 来源 | 结果 |
|------|------|
| 开发自测（会话提供） | 聚焦 93/93、全量 913/913、`npm run lint` 通过、OpenSpec strict validate 通过 |
| 制作人复核 | 聚焦回归 23/23（manifest-v2 + hub 静态契约 + integration） |
| Electron | ⚡ 工作区已启动并持续运行（无新增 uncaught error 报告） |
| Playwright 静态 UI | ✅ 专家 / 技能 / MCP 三 Tab；详情抽屉含依赖、权限、输入输出、风险来源字段 |
| 代码走查 | `capability-manifest-v2.js`、`capability-hub-service.js`、`connectors/unified-store.js`、`capability-hub.js` |

> 注：开发自测与代码审查已分别落盘至 `evidence/dev-self-test.md` 与 `code-review.md`；正式 QA 结果见 `evidence/test-report.md`。

---

## 已知限制（不阻塞 QA）

1. **静态预览 favicon 404**：Playwright / 本地 http 预览常见，非产品错误。
2. **知识图谱与远程 Gateway**：明确 Non-goals，本阶段不验收。
3. **Connector 设置页 ↔ Hub 真机往返**、**重启后迁移幂等**、**high-risk MCP 取消/确认真机点击**：逻辑层回归已覆盖，发布前可做用户数据环境 spot-check。

---

## 体验标准

- [x] ✅ 治理信息分区清晰，不破坏既有 Hub 信息层级
- [x] ✅ 阻断与警告文案可理解（依赖缺失、高风险需确认）
- [x] ✅ 无新增打扰性弹窗（仅 install/enable/import 必要确认）
- [x] ⚡ Electron 真机已运行；静态预览 favicon 404 可忽略

---

## 验收结论

- [x] **通过** / [ ] 不通过
- **验收人**：制作人
- **日期**：2026-08-04
- **备注**：统一能力声明与 Hub 治理体验达到本 Story 目标；允许测试角色按 `qa-plan.md` 接入正式 QA（含 Manual/Electron 与反模式走查）。
