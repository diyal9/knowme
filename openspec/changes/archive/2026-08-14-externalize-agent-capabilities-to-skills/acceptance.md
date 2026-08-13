# 制作人体验验收 — Skill-driven Agent Capabilities

**Change**：`externalize-agent-capabilities-to-skills`  
**轮次**：Windows 原子 rename 稳定性修复后 **第三轮最终复验**（不沿用首轮/第二轮签字）  
**状态**：✅ 通过（可交 QA）  
**验收人**：制作人  
**日期**：2026-08-06

## 审查与门禁前置

| 项 | 结果 | 证据 |
|----|------|------|
| 独立代码审查（B1–B8） | **PASS，无 BLOCKING** | `code-review.md` 第二次独立复审 |
| Windows atomic rename follow-up | **PASS，无 BLOCKING** | `code-review.md`「Windows atomic rename follow-up」；`src/lib/capability-store.js` `renameWithRetrySync` |
| OpenSpec strict validate | PASS | 制作人 2026-08-06 复跑 `npx openspec validate externalize-agent-capabilities-to-skills --strict` |
| Skill/Pack 审查负例回归 | PASS（76/76） | 制作人复跑 skill-experience / skill-runtime-tasks / skill-task-ui / skill-task-catalog / office-catalog-skills / capability-pack |
| Windows capability store 定向回归 | PASS（20/20） | 制作人复跑 `tests/capability-store.test.js` + `tests/connectors.test.js` |
| 全量 `npm test` | PASS（1179/1179） | 制作人 2026-08-06 独立复跑 |
| `npm run lint` | PASS | 制作人 2026-08-06 独立复跑 |
| Harness preflight / gate | PASS | `node .cursor/scripts/harness.js preflight --json` needs_fix=false；hard test/lint 均通过 |
| 隔离 Electron 冒烟 | PASS（15/15，Renderer console 0 error） | `evidence/skill-driven-electron-smoke.json`（B8 修复后口径；Windows 修复未改 Renderer/UI 路径，仍有效） |

---

## 第三轮新增复验：Windows 原子 rename 稳定性（task 7.9）

| 项 | 结果 | 证据 |
|----|------|------|
| 仅主进程持久化层变更，Renderer/IPC/Skill task DTO 无改动 | ✅ 通过 | `writeJsonAtomic` 仍经 tmp→rename；调用面仍限于 `saveInstallStore` 上游 |
| 重试仅针对 EPERM/EACCES/EBUSY，有界退避（20/50/100/200ms，最多 5 次） | ✅ 通过 | `capability-store.js:73-95`；不可重试错误首轮即失败 |
| 失败不伪装成功；旧 store 保留；tmp  best-effort 清理 | ✅ 通过 | `code-review.md` 隔离失败注入；`tests/capability-store.test.js`「retries transient Windows rename locks」 |
| **无 UX / 业务语义变化** | ✅ 通过 | 用户可见入口、preflight、授权拦截、任务标题/Prompt、Pack 启停与 legacy fallback 行为与第二轮复验一致；修复仅消除 Harness/杀毒瞬时锁导致的连接器状态写入偶发失败 |
| B1–B8 关闭状态不受影响 | ✅ 通过 | `code-review.md` 终审 + 本轮 Skill/Pack/Electron 证据未回归 |

---

## 重点复验（B1–B8 修复后）

### A. general 空状态：5 张且含 todayPriority（原 B8）

| 项 | 结果 | 证据 |
|----|------|------|
| 启用 game-studio 后 general Pack 分组展示 5 张卡片 | ✅ 通过 | Electron `general-empty-cards-visible`：查文档/知识库、会议总结、相关聊天、需求梳理、**今日优先级** |
| todayPriority 为动态 Pack-owned task，非 legacy | ✅ 通过 | task catalog 含 `todayPriority`（`surfaces: empty, quick-menu`）；`tests/skill-task-ui.test.js`「appends Pack-owned general empty tasks without legacy scenes」 |
| 无 legacy scene 的 Pack-owned general task 仍可见 | ✅ 通过 | 同上；`code-review.md` B8 CLOSED |
| 截图 | ✅ | `evidence/screenshots/skill-driven-office-home.png`（5 卡含今日优先级） |

### B. writing 真实 UI：4 张均为 Pack-owned Skill task（原 B6）

| 项 | 结果 | 证据 |
|----|------|------|
| 切换写作模式后空状态 4 张卡片 | ✅ 通过 | Electron `writing-empty-uses-pack-skill-tasks`：`writingCards.length === 4` |
| 四任务 identity 为 Pack Skill task | ✅ 通过 | shortcuts：`writingRequirementsDoc` / `writingOfficeDoc` / `writingOutlineDraft` / `writingFinalize`；文案与 sidecar title 一致 |
| 不再退回 legacy 常量 | ✅ 通过 | `tests/skill-task-ui.test.js`「pack-owned writing task overrides writing legacy preset」 |
| 截图 | ✅ | `evidence/screenshots/skill-driven-writing-empty.png` |

### C. taskId 可信重查 + 多 task requiredTools 不互污（原 B4/B7）

| 项 | 结果 | 证据 |
|----|------|------|
| 动态执行传递 `taskId`，Main 从可信 catalog 重查 | ✅ 通过 | `code-review.md` B7：`workspace-agent.js` → `runAI(taskId)`；`main.js` 校验 task.skillId ∈ skillRefs |
| sidecar requiredTools 按**当前 task** 进入 grounding | ✅ 通过 | `tests/skill-runtime-tasks.test.js`「scopes sidecar requiredTools to the activated task identity」 |
| 多 task Skill 不合并其它 task 工具导致误阻断 | ✅ 通过 | taskA→`alpha.read`、taskB→`beta.read` 隔离；无 taskId 手动调用 grounding 为 `[]` |
| 缺工具时在模型生成前阻断并点名 | ✅ 通过 | `code-review.md` B4 CLOSED；`main.js` `toolSurface.isAllowedTool()` |

### D. Pack 安全负例（原 B1–B3/B5）

| 项 | 结果 | 证据 |
|----|------|------|
| 非法 Pack ID 无法越界删除 userData | ✅ 通过 | `tests/capability-pack.test.js`「rejects traversal pack ids without deleting sibling user data」→ `invalid_pack_id` |
| 复制失败保留旧版本、不登记残包 | ✅ 通过 | `tests/capability-pack.test.js`「keeps the prior installed pack when safe copy fails」→ `pack_copy_failed` |
| bundled Pack 不绕过原子依赖检查 | ✅ 通过 | `tests/capability-pack.test.js`「uses unified atomic dependencies…」；空 availability → `dependency_conflict` |
| 跨来源重复 task ID 确定性去重 + 告警 | ✅ 通过 | `tests/skill-runtime-tasks.test.js`「replaces lower-priority duplicate task ids and emits a diagnostic」→ `duplicate_task_id` |

---

## 核心体验项（C 端用户视角）

### 1. 标准 Skill 兼容

| 项 | 结果 | 证据 |
|----|------|------|
| 纯 `SKILL.md` 无 sidecar 仍可发现/运行 | ✅ | `tests/skill-runtime-tasks.test.js` |
| 无效扩展仅隔离坏 task | ✅ | `tests/skill-experience.test.js` |
| 8 个 catalog Skill 结构完整 | ✅ | `tests/office-catalog-skills.test.js` |

### 2. 动态空状态 / 快捷菜单

| 项 | 结果 | 证据 |
|----|------|------|
| general 5 卡 + writing 4 卡均由 Skill task catalog 驱动 | ✅ | Electron 15/15；见重点复验 A/B |
| Ctrl/Cmd+K 展示相关聊天、今日优先级等动态任务 | ✅ | Electron `quick-menu-uses-skill-tasks` |
| 空状态与快捷菜单共享 task identity / preflight | ✅ | `specs/agent-chat-ux/spec.md`；`runDynamicTask` 统一路径 |

### 3. 未授权固定提示

| 项 | 结果 | 证据 |
|----|------|------|
| 飞书关闭时点击相关聊天仅显示固定授权引导 | ✅ | Electron `unauthorized-preflight-blocks-generation` |
| 未启动 LLM / 业务工具 | ✅ | 同上；截图 `skill-driven-auth-preflight.png` |

### 4. 不污染用户 prompt

| 项 | 结果 | 证据 |
|----|------|------|
| `skillRefs` 独立注入 L1，用户气泡无 slash | ✅ | `tests/skill-task-ui.test.js`；Electron `pack-skill-l1-loads` |
| IPC DTO 不含 path/body/script/secret | ✅ | Electron `display-safe-dto` |

### 5. 旧入口 fallback

| 项 | 结果 | 证据 |
|----|------|------|
| scene-only 旧入口仍可用 | ✅ | Electron `legacy-scene-fallback` |
| 动态 task 同 id 优先于 legacy | ✅ | `tests/skill-task-catalog.test.js` |

### 6. Skill/sidecar 可更新业务入口（无需改核心）

| 项 | 结果 | 证据 |
|----|------|------|
| sidecar title/prompt/preflight 变更反映到 DTO 与 UI | ✅ | 动态覆盖单测 + Pack catalog 外置；writing/general 均已走动态路径 |
| Pack content hash 刷新 discovery | ✅ | `design.md` D9；runtime revision 机制 |

### 7. OAuth / Registry / 审批 / grounding 仍由内核托管

| 项 | 结果 | 证据 |
|----|------|------|
| 连接器授权由宿主判定 | ✅ | 未授权冒烟 + `feishuUserAuthReady` |
| requiredTools 仅声明，工具执行走 Registry | ✅ | B4/B7 复验 |
| 审批 bypass / secret / 脚本表达式被拒绝 | ✅ | `tests/skill-experience.test.js` 负例 |

---

## Smoke Scope 对照（qa-plan）

| Smoke 项 | 制作人结论 |
|----------|------------|
| Skill runtime 标准/sidecar/来源/禁用 | ✅ |
| Pack trusted/imported/启停/legacy + 安全负例 | ✅ B1–B3/B5 负例已覆盖 |
| Agent UI general 5 卡 / writing 4 卡 / Ctrl+K / preflight | ✅ Electron + 单测 |
| 飞书四任务入口与 preflight | ✅；**授权后真实工具链留 QA** |
| 写作四任务 material preflight | ✅ sidecar + 真实 UI；**缺素材续跑留 QA** |
| 安全：未授权不调用 LLM、缺工具不伪造 | ✅ |

---

## 非阻塞留测项（交 QA）

以下不影响制作人放行：

1. **授权飞书后**四任务 E2E（related_chats / meeting 候选 / today_priority / doc_kb_suggest）。
2. **写作模式**点击四卡 → 缺素材一句追问 → 补素材自动续跑（UI 入口已验，交互链留 QA）。
3. **Ctrl/Cmd+K 与空状态**同一 task 的 preflight 等价性手测一条。
4. **live 修改 sidecar title** 后 refresh catalog 手测（DTO 合并逻辑已由单测覆盖）。
5. `code-review.md` A1–A3 为 ADVISORY，不阻塞 QA；A4 证据计数已在 dev-self-test 同步。

> 注：仓库内 `evidence/test-report.md` 基于审查前证据（14/14、4 卡），QA 应以本 acceptance 与最新 15/15 冒烟为准重新核对或更新报告。

---

## BLOCKING 问题

**无。** B1–B8 均已关闭；Windows atomic rename follow-up 无新增 BLOCKING；制作人第三轮最终复验未发现新的阻塞项。

---

## 验收结论

- [x] **通过**
- [ ] 不通过

**结论说明**：代码审查 B1–B8 修复后，general 空状态已正确展示 **5 张**（含 todayPriority），writing 真实 UI **4 张**均为 Pack-owned 动态 Skill task；task 级 requiredTools 与 Main 可信 catalog 重查已生效；Pack 越界删除/事务安装/依赖/重复 task 负例均有测试覆盖。第三轮在 task 7.9（Windows 原子 rename 有界重试）落地后，制作人独立复验：Electron **15/15**（沿用 B8 修复后冒烟，UI 路径未变）、Skill/Pack 定向 **76/76**、Windows store **20/20**、全量 **1179/1179**、lint/OpenSpec strict/Harness 均 PASS；与 `code-review.md` 终审及 Windows follow-up 结论一致。

**Windows 稳定性修复说明**：`capability-store.js` 的 `renameWithRetrySync` 仅在主进程 install-store 原子写入时对瞬时文件锁做有限重试，**不改变** Skill 入口发现、preflight、授权拦截、任务执行、Pack 生命周期或用户可见文案；成功路径与修复前语义一致，失败路径仍向上抛出原始错误。

**可交 QA**：是。请测试按 `qa-plan.md` Anti-pattern Checks 与上述留测项执行，并以最新证据更新 `evidence/test-report.md`。
