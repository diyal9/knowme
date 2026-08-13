# Code Review — extract-game-studio-capability-pack

**审查日期**：2026-08-04  
**审查人**：开发（Developer）  
**结论**：**PASS — 无 BLOCKING 缺陷，可进入制作人验收 / 基线归档**

---

## 审查范围

| 维度 | 主要文件 |
|------|----------|
| Manifest 校验 | `src/lib/capability-pack-schema.js` |
| Store / 路径约束 | `src/lib/capability-pack-store.js`, `src/lib/capability-store.js` |
| 生命周期运行时 | `src/lib/capability-pack-runtime.js` |
| game-studio 包 | `src/packs/game-studio/pack.json`, `scenes.json`, `requirement-schema.json` |
| 第三方示例 | `src/packs/example-minimal/pack.json` |
| Legacy 适配 | `src/lib/game-studio-scenes.js` |
| 场景路由 | `src/lib/assistant-prompt-router.js` |
| Electron 边界 | `src/main.js`, `src/preload.js`, `src/workspace-agent.js` |

对照：`proposal.md`、`design.md`、2 份 delta spec、`tasks.md`（全部 `[x]`）、`qa-plan.md`。

---

## 1. Manifest 校验（capability-pack spec）

**结论：PASS**

- `validatePackManifest` 强制 `schemaVersion === 1`、kebab-case id、semver version、必填 name/description。
- 无效 id / 版本 / schema 返回 `{ ok: false, code, error }`，**不写入 store**（`loadManifestFromRoot` 失败时 `discoverPacks` 跳过该 pack）。
- `loadManifestFromRoot` 二次经 `adaptLegacyCapability('pack', …)` 接入 Capability Fabric 统一声明，与后续 `unify-capability-fabric-foundation` 边界一致。
- bundled `game-studio` manifest 经 `tests/capability-pack.test.js` 校验通过。

**关键实现点**

- 场景可内联于 manifest 或外置 `scenesFile`（game-studio 使用 `scenes.json`）。
- `requirementSchema` 相对路径延迟加载，经 `resolvePackFile` 读取。

---

## 2. 生命周期持久化

**结论：PASS**

| 操作 | 实现 | 持久化 |
|------|------|--------|
| 发现 | `listBundledPackIds` + store 已装 id 合并 | bundled 无 store 条目亦可发现，`enabled: false` |
| 安装 bundled | `installPack(packId, 'bundled')` | `pack-store.json` 写入 status/enabled/version/contentHash/installedAt |
| 启用 / 禁用 | `enablePack` / `disablePack` | upsert + `clearCache()` |
| 卸载 | `uninstallPack` | 删除 `installed/<id>` + removeEntry |
| 第三方目录 | `installFromDirectory` | `copyDirectorySafe` → `installed/<id>`，source=`installed` |

- Store 路径：`%APPDATA%\KnowMe\capability-packs\pack-store.json`（`resolvePackPaths`）。
- 禁用后 `listEmptyStateGroups` / `listScenesForUi` 不再包含该 pack 场景（`office-partner` 用例覆盖）。
- `migrateLegacyGameIndustry('game')`：`isPackEnabled` 短路 + `installPack` upsert，**幂等**（开发自审 ad-hoc：双次调用 `packCount === 1`）。

**IPC / preload**

- `capability-pack-list` / `-empty-state` / `-install` / `-enable` / `-disable` / `-uninstall` 均在主进程 `ensureCapabilityPackRuntime()` 后执行。
- Renderer 经 `window.api.capabilityPack*` 消费 DTO；`workspace-agent.js` 空状态分组走 `capabilityPackEmptyState`。

---

## 3. 依赖与路径 confinement

**结论：PASS**

**路径约束**

- `resolvePackFile`：标准化相对路径、拒绝 `..`、`assertPathInsideRoot(packRoot, full)`。
- `readPackFile('game-studio', '../../../package.json')` 测试返回 `ok: false`。

**Pack 依赖**

- `checkDependencies`：pack 级 `dependencies[]` 须已启用；注入 `getAvailableCapabilityManifests` 时走 `checkCapabilityDependencies`（统一原子依赖）。
- 缺失依赖返回 `dependency_conflict` 并列出 id（game-studio + 空 registry 用例）。
- bundled 安装时 `source === 'bundled'` 跳过 pack 依赖硬拦（design：bundled 按需发现，不阻塞首启）；非 bundled / enable 仍校验。

**内容哈希**

- `hashDirectory` 用于 install 证据（16 字符 sha256 摘要）。

---

## 4. Legacy 场景 / Session 兼容（game-studio-scenes spec）

**结论：PASS**

- `game-studio-scenes.js` 为薄适配层，数据来自 `src/packs/game-studio/scenes.json`。
- `legacyModeMap`：`writing→game-design`、`coding→game-dev`、`general→game-production`、`steward→game-knowledge`。
- `resolveGameScene` 要求 `industry=game` 且 pack 已启用；非 game industry 返回 null。
- Session 原始 mode/agentId **不改写**；仅运行时映射场景（design §4）。
- `game-knowledge` 场景 `showInEmptyState: false`，空状态仅暴露 4 个业务入口。
- 关键词分类（如「daemon 工作流开发」→ `game-dev`）与 legacy mode 映射均有测试。

**说明（ADVISORY）**

- spec / qa-plan 提及 `qa`、`planning` legacy mode，但产品 `MODE_IDS` 仅含 `general|steward|writing|coding`；`game-qa` 经 prompt 关键词命中，非独立 session mode。与历史 Session 模型一致，不构成 BLOCKING。

---

## 5. 第三方 pack（无核心分支）

**结论：PASS**

- `example-minimal` 内联 scenes + ui 元数据，经 `installFromDirectory` 安装后 `listEmptyStateGroups` 出现 `example-minimal` 分组。
- 无需修改 `main.js` / `workspace-agent.js` 分支即可渲染空状态卡片（通用 `renderPackEmptyStateHtml`）。

**说明（ADVISORY）**

- `installFromDirectory` 目前仅 runtime API + 单测覆盖；preload **未**暴露目录选择 IPC。符合 proposal 非目标「本 Story 不增加能力 Hub 能力包 Tab」；目录导入 UI 留后续 Story。

---

## 6. game-studio 路由回归

**结论：PASS**

| 路径 | 行为 | 测试 |
|------|------|------|
| `assistant-prompt-router` | `industry=game` + mode → pack 场景 | `assistant-prompt-router.test.js` |
| `game-studio-scenes` | legacy mode / 关键词 / UI 列表 / prompt 构建 | `game-studio-scenes.test.js` |
| `game-requirement.js` | 从 pack 读取 requirement schema | `capability-pack.test.js` |
| `main.js` IPC | `game-studio-scenes` list + pack empty state | 全量 967 测试通过 |

- 启用 pack 后四场景可见；禁用后空状态分组消失。
- 与 Capability Hub / Expert / Skill 列表无交叉写入（独立 pack store，design 决策 §2）。

---

## 7. Electron 安全边界

**结论：PASS**

- manifest 校验、目录复制、store 读写、legacy 迁移均在主进程。
- preload 暴露窄 DTO API；Renderer 无 Node `fs` 权限。
- 启动懒加载 `ensureCapabilityPackRuntime()`；`migrateLegacyGameIndustry` 包在 try/catch 内，失败不阻塞应用。

---

## 8. tasks.md 完成度

| 章节 | 状态 |
|------|------|
| 1. Capability Pack 契约 | 全部 `[x]` |
| 2. Game Studio 能力包 | 全部 `[x]` |
| 3. Electron 接入 | 全部 `[x]` |
| 4. 验证 | 全部 `[x]` |

---

## 自动化与门禁复核（开发自审当日）

| 检查项 | 结果 |
|--------|------|
| 聚焦回归 14/14（pack + game-studio-scenes） | PASS |
| 全量 `npm test` 967/967 | PASS |
| `npm run lint` | PASS |
| `openspec validate extract-game-studio-capability-pack --strict` | PASS |
| harness gate | blocking=false |

---

## 残余风险（ADVISORY，非 BLOCKING）

| 项 | 级别 | 说明 |
|----|------|------|
| 目录导入无 IPC/UI | ADVISORY | runtime 已就绪；QA 手动导入需 dev 脚本或后续 Hub Story |
| legacy 迁移无单测 | ADVISORY | ad-hoc 验证幂等；建议 QA 重启场景 spot-check |
| bundled 跳过原子依赖硬拦 | ADVISORY | 与 design 一致；Fabric 主 change 可统一 registry 注入 |
| qa/planning mode 文案 | ADVISORY | spec 宽于实际 MODE_IDS；行为由关键词 + 四 mode 映射覆盖 |

---

## 审查结论

**PASS**。实现与 proposal / design / delta spec / tasks 一致；硬门禁全绿；无 BLOCKING 缺陷。建议顺序：本 change 基线归档 → `unify-capability-fabric-foundation` 归档 → 制作人验收 / 测试 QA（`acceptance.md`、`test-report.md`）。
