# 制作人体验验收: extract-game-studio-capability-pack

> 开发自测通过后填写。测试 QA 接入前必须本清单全部勾选。

**验收日期**：2026-08-04  
**验收人**：制作人  
**结论**：**PASS — 允许进入正式 QA**

## 验证方式图例

| 标记 | 含义 |
|------|------|
| ✅ | 单元·集成测试 / 代码走查 / 制作人 ad-hoc 脚本已证实 |
| ⚡ | Electron 启动冒烟（用户确认工作区正常、无 uncaught error） |
| 🔜 | 真机交互待 QA 补证（不阻塞制作人放行） |

---

## 评估维度

### 游戏四场景用户价值

- [x] ✅ 四场景覆盖完整研发链路：策划需求 → 研发实现 → 测试验收 → 制作推进 — `src/packs/game-studio/scenes.json` 标签、描述、emptyPrompt 可读可点
- [x] ✅ 每场景绑定 Expert / Skill / 连接器 / 默认工作流（研发场景 `game-dev-delivery`）— manifest + scenes 声明一致
- [x] ✅ 空状态仅暴露 4 个业务入口；`game-knowledge` 管理场景隐藏（`showInEmptyState: false`）— `game-studio-scenes.test.js`
- [x] ✅ 关键词路由补全测试/制作等无独立 Session mode 的场景（如「测试|qa|验收」→ `game-qa`）— 分类与 prompt 构建测试通过
- [x] ✅ 需求 schema 从 pack 延迟加载，策划场景可产出结构化需求案 — `getRequirementSchema` 测试含 `acceptance` 段

### Legacy 用户迁移

- [x] ✅ 仅 `industry=game` 且 pack 未启用时自动安装并启用 bundled `game-studio` — `migrateLegacyGameIndustry` + 开发 ad-hoc
- [x] ✅ 重复启动幂等：`packCount === 1`，第二次调用 `ok: true` 无重复 store 条目 — 制作人 ad-hoc 脚本复核
- [x] ✅ Legacy Session mode 运行时映射：`writing→game-design`、`coding→game-dev`、`general→game-production`、`steward→game-knowledge` — 不改写 Session agentId
- [x] ✅ 非游戏行业不触发迁移 — `resolveGameScene({ industry: 'software' })` 返回 null

### 启停边界

- [x] ✅ Bundled pack 可发现、初始 `enabled: false`，不预占空状态 — `discoverPacks` 测试
- [x] ✅ 安装/启用后四场景出现在 `listEmptyStateGroups`；禁用后分组消失 — install + disable 测试（game-studio / office-partner）
- [x] ✅ 启停状态写入 `%APPDATA%\KnowMe\capability-packs\pack-store.json` 并清缓存 — runtime 实现走查
- [x] ✅ 卸载 imported pack 删除用户副本与 store 条目；bundled 源目录只读 — design §2 + runtime
- [x] ⚡ 用户确认 Electron 工作区启动正常；🔜 QA 重启后启停持久化 spot-check

### 第三方 pack 扩展

- [x] ✅ `example-minimal` 经 `installFromDirectory` 安装后空状态出现独立分组 — 无需修改 `main.js` / `workspace-agent.js` 分支
- [x] ✅ 通用 `renderPackEmptyStateHtml` 按 pack UI 元数据渲染 kicker/hero/sub/卡片 — `workspace-agent.js` 走查
- [x] ✅ 无效 manifest、路径穿越、缺失依赖均被拒绝 — schema + traversal + dependency_conflict 测试
- [x] 🔜 目录导入无 preload IPC / Hub Tab（本 Story 非目标）；QA 可用 runtime API 或后续 Story 补 UI

### 不影响通用办公场景

- [x] ✅ 未启用任何 pack 时，工作伙伴空状态仍走 steward / coding / writing / general 既有快捷入口 — `workspace-agent.js` 回退链
- [x] ✅ 游戏场景解析要求 `industry=game` **且** pack 已启用；办公用户无意外游戏入口 — `game-studio-scenes.js`
- [x] ✅ `office-partner` 为独立 bundled pack，默认未启用，与 game-studio 生命周期隔离 — discover 测试
- [x] ✅ Capability Hub / Expert / Skill 列表与 install store 无交叉写入 — design 决策 §2 + code-review
- [x] ✅ Renderer 仅经 preload IPC 消费 DTO，无 Node 文件系统权限 — 安全边界走查

---

## Smoke Scope 对照（qa-plan.md）

| 项 | 状态 |
|----|------|
| bundled `game-studio` 可发现、初始未启用 | ✅ discover 测试 |
| 安装后四场景可见 | ✅ install + listScenesForUi |
| 禁用后空状态消失 | ✅ disable + listEmptyStateGroups |
| `industry=game` 首次启用、重复无重复条目 | ✅ ad-hoc 幂等脚本 |
| writing/coding legacy Session 映射 | ✅ game-studio-scenes + assistant-prompt-router |
| example-minimal 第三方安装 | ✅ installFromDirectory 测试 |
| 路径穿越 / 无效 manifest 拒绝 | ✅ traversal + invalid id 测试 |
| Electron 重启持久化 + 控制台无 error | ⚡ 用户确认启动；🔜 QA 真机重启 |

---

## 证据

| 来源 | 结果 |
|------|------|
| 开发自测 | 聚焦 14/14、全量 967/967、lint、OpenSpec strict validate、harness gate 均 PASS |
| 制作人复核 | 聚焦回归 14/14 独立重跑 PASS；legacy 迁移幂等 ad-hoc PASS |
| 代码审查 | `code-review.md` 结论 PASS，无 BLOCKING |
| Electron | ⚡ 用户确认工作区启动正常 |
| 代码走查 | `capability-pack-runtime.js`、`game-studio-scenes.js`、`workspace-agent.js`、`src/packs/game-studio/` |

> 正式 QA 结果见 `evidence/test-report.md`；截图见 `evidence/screenshots/`（QA 阶段补齐）。

---

## 已知限制（不阻塞 QA）

1. **能力包 Hub Tab / 目录选择 IPC**：本 Story 非目标；bundled 安装与 legacy 迁移已覆盖主路径，目录导入仅 runtime + 单测。
2. **legacy 迁移无独立单测文件**：ad-hoc 与开发自审已验证幂等；建议 QA 对 `industry=game` 用户数据做重启 spot-check。
3. **spec 中 qa/planning mode 宽于产品 MODE_IDS**：实际由四 mode 映射 + 关键词分类覆盖，与历史 Session 模型一致。
4. **启用 pack 后空状态优先展示 pack 分组**：对游戏行业用户为预期行为；禁用 pack 即恢复通用办公空状态。

---

## 体验标准

- [x] ✅ 四场景文案清晰、任务导向，与游戏工作室工作流一致
- [x] ✅ 启停边界明确：未启用不打扰、禁用即收回入口
- [x] ✅ 无新增打扰性弹窗；legacy 迁移静默、可禁用回退
- [x] ⚡ Electron 真机已运行；办公默认路径未被游戏 pack 污染

---

## 验收结论

- [x] **通过** / [ ] 不通过
- **验收人**：制作人
- **日期**：2026-08-04
- **备注**：游戏研发能力包提取达到本 Story 目标；架构验证「核心工作台 + 行业能力包」可行。允许测试角色按 `qa-plan.md` 接入正式 QA（含 Manual/Electron、重启持久化与反模式走查）。
