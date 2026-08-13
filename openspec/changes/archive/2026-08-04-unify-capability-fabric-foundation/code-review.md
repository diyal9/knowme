# Code Review — unify-capability-fabric-foundation

**审查日期**：2026-08-04  
**审查人**：开发（Developer）  
**结论**：**PASS — 无 BLOCKING 缺陷，可进入 Story 完成门禁**

---

## 审查范围

| 维度 | 主要文件 |
|------|----------|
| Manifest v2 纯函数 | `src/lib/capability-manifest-v2.js` |
| Connector 单源 | `src/lib/connectors/unified-store.js` |
| Hub 生命周期 | `src/lib/capability-hub-service.js`, `src/main.js` |
| Runtime 兼容 | `expert-runtime.js`, `skill-runtime.js`, `capability-pack-runtime.js`, `cursor-capability-repository.js` |
| Electron 边界 | `main.js`, `preload.js`, `capability-hub.js` |
| game-studio 回归 | `assistant-prompt-router.js`, `game-studio-scenes.js` |

对照：`proposal.md`、`design.md`、6 份 delta spec、`tasks.md`、`qa-plan.md`、`acceptance.md`、`evidence/test-report.md`。

---

## 1. Capability Manifest v2 纯函数边界

**结论：PASS**

- `capability-manifest-v2.js` 无 `fs`/`electron`/`path` 依赖，仅导出 normalize/validate/adapt/graph/risk 纯函数。
- 输入为普通对象，输出统一 `{ ok, manifest?, issues?, warnings? }` 形状，符合 design §2「IO 留给调用方」。
- `adaptLegacyCapability` 不修改原始来源；`serializeSidecar` 供 import/store 按需 materialize。
- 运行状态（enabled/status）未写入 manifest DTO，符合 spec「运行状态 MUST NOT 写入声明」。

**关键实现点**

- `validateAndNormalizeManifest`：schemaVersion/kind/id/semver/自依赖校验。
- `checkDependencyGraph`：重复 id、缺失 required/optional、kind mismatch、环检测（`dependency_cycle`）。
- `deriveRisk` / `aggregateRisk`：`low|medium|high|critical` 规范化；MCP connector 无显式 risk 时推导为 `high`。
- `dependenciesForLegacy`：Expert skills/connectors、Pack expert/skills/connectors 自动映射为统一依赖引用。

---

## 2. 依赖图与 risk 语义

**结论：PASS**

| 场景 | 实现 | 测试 |
|------|------|------|
| required 缺失 | `checkDependencyGraph` → `missing_dependency`；Hub `validateCapabilityActivation` → `dependency_conflict` | manifest-v2 + integration |
| optional 缺失 | `missing_optional_dependency` warning，不阻断 | manifest-v2 |
| 依赖环 | DFS + `dependency_cycle` + cycle 路径 | manifest-v2 |
| kind 歧义 | `dependency_kind_mismatch` | manifest-v2 |
| high/critical 未确认 | Hub service L365 拦截 `risk_confirmation_required`；import/pack 同码 | integration + import |
| 风险聚合 | Pack `checkCapabilityDependencies` + install 前 risk 校验 | capability-pack |

**设计分层核对**：静态层（manifest 模块）与运行层（install store 可用性）分离，与 design §3 一致。Hub `validateCapabilityActivation` 以 install store + enabled 状态判断 required 依赖，而非仅静态图——符合「运行层以 install store 判断」决策。

---

## 3. Connector unified store 单源与迁移幂等性

**结论：PASS**

- **权威路径**：`writeManagedConnector` → manifest.json + sidecar + capability install store → `projectLegacy()` 单向重建 `connectors.json`。
- **读取模式**：`dual`（默认）/ `unified` / `legacy`，可通过 `KNOWME_CONNECTOR_STORE_MODE` 回退。
- **迁移幂等**：`.connectors-unified-v2` flag 存在则 skip；`connectors.json.unified-v2.bak` 与 install store 备份；已存在 managed 条目跳过重复写入。
- **manifest-only**：无 legacy 条目时 managed manifest + sidecar 即可运行，Agent runtime 经 unified store 投影。
- **写操作一致性**：`upsertConnector` / `setAllowlist` / `setEnabled` / `removeConnector` 均 authority-first 后投影。

**残余 ADVISORY**：双文件（managed + connectors.json 投影）仍在，但所有写路径经 unified store，与 design trade-off 一致。

---

## 4. Hub service 生命周期

**结论：PASS**

- `main.js` 懒加载：`ensureCapabilityHub()` → `createCapabilityHubService({ getUserData, bundledRoot, getConnectorsApi, ... })`。
- 启动迁移：`migrateConnectorsIfNeeded()` 委托 `unifiedConnectors.migrateLegacy()`，失败不阻塞应用（try/catch 在 pack runtime 同级模式）。
- IPC 通道：25 个 handler 名称与 preload 形状未变（capability 11 + skill 5 + expert 5 + connector 3 + pick 3）。
- 列表缓存：catalog 合并 + `mapCatalogItemToHub` 序列化 DTO，Renderer 不接收绝对路径或 secret。
- Connector 启停：`connectorLifecycle` 联动 MCP onConnectorEnabled/Disabled + unified store + legacy 投影。

---

## 5. Expert / Skill / Pack / Cursor repository 兼容性

**结论：PASS**

| 组件 | 统一声明接入 | 兼容保证 |
|------|-------------|----------|
| Expert | `validateBindings` 在 snapshot/try-chat 前校验 skills/connectors | 旧 EXPERT.md frontmatter 不变 |
| Skill | sidecar 优先，否则 `adaptLegacyCapability('skill', frontmatter)` | L0–L3 路径边界、沙箱、traversal 测试保留 |
| Pack | `adaptLegacyCapability('pack')` + `checkCapabilityDependencies` | 不维护第二套 schema；game-studio 依赖冲突场景有测 |
| Cursor linked | 扫描时内存适配；注册写入 userData 受管目录 sidecar，**不写回仓库** | `cursor-capability-repository.test.js` |

Import/store 安装前校验 trust、依赖、risk；materialize sidecar 保留旧 store entry 字段。

---

## 6. Electron 主进程边界

**结论：PASS**

- Manifest/目录/迁移/store IO 均在主进程 lib 层；`capability-hub.js` Renderer 仅调用 preload bridge。
- `validateCapabilityActivation` 在后端强制 risk/dependency 门禁，非仅靠 UI。
- Session 快照、Agent context assembly、Skill 沙箱权限未重构；非目标（executor 重构、远程 OAuth）未越界。

---

## 7. game-studio 路由回归

**结论：PASS**

- `assistant-prompt-router.js` 继续经 `capability-pack-runtime.resolveScene/buildScenePrompt` 路由。
- 聚焦测试包含 `game-studio-scenes.test.js`、`assistant-prompt-router.test.js`、`capability-pack.test.js`（install/scenes/schema/dependency_conflict）。
- `main.js` `migrateLegacyGameIndustry` 与 pack runtime 懒加载未破坏既有 industry 迁移。

---

## 自动化与门禁复核（开发自审当日）

| 检查项 | 结果 |
|--------|------|
| 聚焦回归 106/106 | PASS |
| 全量 `npm test` 967/967 | PASS |
| `npm run lint` | PASS |
| OpenSpec strict validate | PASS |
| harness gate | blocking=false |

与 QA `evidence/test-report.md` 结论一致。

---

## 发现汇总

### BLOCKING

无。

### ADVISORY

1. **真机深度 spot-check**：设置页 Connector allowlist 往返、用户数据上的重启迁移、high-risk 取消/确认点击——逻辑层已测，Electron 启动冒烟已通过，可在发布前补充用户数据环境验证。
2. **adapter 推导精度**：legacy 风险/依赖由 adapter 推导，provenance.adaptedFrom 已标记；作者可后续提供显式 v2 sidecar 提升精度（design 已知 trade-off）。

### 审查后修复

- QA 指出的 `critical` 风险 UI 确认缺口已修复：安装和启用现在统一对 `high` / `critical` 前置 `window.confirm`，取消时不调用 bridge。
- `capability-hub.test.js` 增加静态契约，确保安装与启用两条路径均覆盖 `high` / `critical`。
- 修复后聚焦 15/15、全量 967/967、lint 与 OpenSpec strict validate 均通过。

---

## 审查结论

- [x] **PASS** — 实现与 OpenSpec spec/design 一致，硬门禁全过，无 BLOCKING 代码缺陷
- [ ] FAIL

**签字**：开发  
**日期**：2026-08-04
