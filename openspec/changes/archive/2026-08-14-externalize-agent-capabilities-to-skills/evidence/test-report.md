# 测试报告: externalize-agent-capabilities-to-skills

**Change**：`externalize-agent-capabilities-to-skills`  
**轮次**：Windows atomic rename 稳定性修复后 **第三轮最终 QA 复验**（不沿用第二轮 1178/1178 旧计数）  
**测试人**：Tester（QA）  
**日期**：2026-08-06  
**前置**：开发自测 PASS（含 task 7.9）；制作人第三轮 `acceptance.md` 签字通过；`code-review.md` 终审 + Windows follow-up 无 BLOCKING

---

## 门禁

| 级别 | 检查项 | 结果 | 证据（QA 第三轮独立复跑） |
|------|--------|------|---------------------------|
| 硬 | `npm test` | **PASS**（1179/1179） | 2026-08-06 QA 第三轮复跑 |
| 硬 | `npm run lint` | **PASS** | `lint ok` / `script-scope ok` |
| 硬 | OpenSpec strict validate | **PASS** | `npx openspec validate externalize-agent-capabilities-to-skills --strict` |
| 软 | qa-plan Smoke Scope | **已执行** | 见 Smoke / B1–B8 / Windows 7.9 |
| 软 | code-review.md | **已完成，无 BLOCKING** | B1–B8 CLOSED + Windows follow-up PASS |

---

## 第三轮新增：Windows atomic rename（task 7.9）

| 验证点 | 结果 | 证据 |
|--------|------|------|
| 仅 `capability-store.js` 持久化层变更，Renderer/IPC/Skill DTO 无改动 | **PASS** | 源码走读：`writeJsonAtomic` → `renameWithRetrySync`；调用链仍限于 `saveInstallStore` |
| 重试仅针对 `EPERM`/`EACCES`/`EBUSY`，有界退避 20/50/100/200ms，默认最多 5 次尝试 | **PASS** | `capability-store.js:73-95`；`retries` 默认 4（初次 + 4 次重试） |
| 不可重试错误首轮即失败，不无限等待 | **PASS** | `!retryable \|\| attempt >= retries` 跳出；code-review 隔离注入 `ENOENT` 仅 1 次 |
| 失败向上抛出原始错误，不伪装成功 | **PASS** | `writeJsonAtomic:103-106` 在 `!renamed.ok` 时 `throw renamed.error` |
| 失败 best-effort 清理随机 tmp，旧 store 保留 | **PASS** | tmp 命名 `${file}.${pid}.${randomHex}.tmp`；失败 `fs.rmSync(tmp,{force:true})`；同目录 rename 不先删目标 |
| 新回归单测 | **PASS** | `tests/capability-store.test.js`「retries transient Windows rename locks with a finite bound」 |
| Windows store + connector 定向回归 | **PASS**（20/20） | `node --test tests/capability-store.test.js tests/connectors.test.js` |
| B1–B8 / UI 路径无回归 | **PASS** | Skill/Pack 99/99；Electron 15/15 沿用 B8 修复后证据（UI 未改） |

**Windows 7.9 结论：PASS，无 BLOCKING。**

---

## B1–B8 审查负例复测（回归确认）

| 编号 | 验证点 | 结果 | 独立证据 |
|------|--------|------|----------|
| **B1** | 非法 Pack ID 不删除兄弟 userData | **PASS** | `capability-pack.test.js`「rejects traversal pack ids…」→ `invalid_pack_id` |
| **B2** | 复制失败不登记残包、保留旧版 | **PASS** | 「keeps the prior installed pack when safe copy fails」→ `pack_copy_failed` |
| **B3** | bundled Pack 原子依赖不可绕过 | **PASS** | 「uses unified atomic dependencies…」→ `dependency_conflict` |
| **B4** | sidecar `requiredTools` 进入主进程工具面并阻断 | **PASS** | `skill-runtime-tasks.test.js` + `agent-run-executor-grounding.test.js` |
| **B5** | 跨来源 task ID 去重 + `duplicate_task_id` 告警 | **PASS** | `skill-runtime-tasks.test.js`「replaces lower-priority duplicate task ids…」 |
| **B6** | writing 4 张动态卡（Pack-owned，非 legacy） | **PASS** | Electron `writing-empty-uses-pack-skill-tasks`；`skill-task-ui.test.js` |
| **B7** | 多 task Skill 按可信 `taskId` 隔离 requiredTools | **PASS** | `skill-runtime-tasks.test.js`「scopes sidecar requiredTools to the activated task identity」 |
| **B8** | general **5 张**且含 `todayPriority` | **PASS** | Electron `general-empty-cards-visible`（5 卡含「今日优先级」） |

**B1–B8 结论：8/8 CLOSED，无 BLOCKING。**

---

## Smoke 结果

| 用例 | 结果 | 备注 / 证据 |
|------|------|-------------|
| 标准 `SKILL.md` 无 sidecar 兼容 | PASS | `skill-runtime-tasks.test.js` |
| 8 项办公 Skill 动态 task catalog | PASS | Electron `eight-office-skill-tasks` |
| **general 空状态 5 卡**（含 todayPriority） | PASS | Electron `general-empty-cards-visible`；截图 `skill-driven-office-home.png` |
| **writing 空状态 4 卡**（Pack Skill task） | PASS | Electron `writing-empty-uses-pack-skill-tasks`；截图 `skill-driven-writing-empty.png` |
| Ctrl+K 含相关聊天、今日优先级 | PASS | Electron `quick-menu-uses-skill-tasks` |
| 未授权飞书：固定引导、不启动生成 | PASS | Electron `unauthorized-preflight-blocks-generation` |
| IPC DTO 最小化 | PASS | Electron `display-safe-dto` |
| explicit skillRefs / L1 注入 | PASS | Electron `pack-skill-l1-loads` |
| scene-only legacy fallback | PASS | Electron `legacy-scene-fallback` |
| Pack provenance / install | PASS | Electron `dynamic-task-provenance`、`install-game-studio-pack` |
| Renderer console 0 error | PASS | Electron `no-renderer-console-errors` |

### Electron 冒烟汇总

| 脚本 | QA 结果 | 时间戳 |
|------|---------|--------|
| `skill-driven-electron-smoke.js` | **15/15 PASS**（沿用 B8 修复后证据，Windows 7.9 未改 UI 路径） | `skill-driven-electron-smoke.json` @ 2026-08-05T19:09:19Z |

general 5 卡实测文案：查文档/知识库、会议总结、分析跟我相关的聊天、需求梳理、**今日优先级**。  
writing 4 卡 shortcuts：`writingRequirementsDoc` / `writingOfficeDoc` / `writingOutlineDraft` / `writingFinalize`。

---

## Regression 结果

### QA 第三轮独立命令与结果

```bash
# Windows capability store + connector
node --test tests/capability-store.test.js tests/connectors.test.js
# → 20/20 PASS

# Skill/Pack B1–B8 审查负例 + UI 契约
node --test tests/skill-experience.test.js tests/skill-runtime-tasks.test.js \
  tests/skill-runtime.test.js tests/skill-task-catalog.test.js tests/skill-task-ui.test.js \
  tests/office-catalog-skills.test.js tests/capability-pack.test.js \
  tests/skill-grounding-contract.test.js tests/agent-run-executor-grounding.test.js
# → 99/99 PASS

npm test
# → 1179/1179 PASS

npm run lint
# → lint ok / script-scope ok

npx openspec validate externalize-agent-capabilities-to-skills --strict
# → Change is valid
```

| 范围 | 结果 |
|------|------|
| Windows store + connector | **20/20 PASS** |
| Skill/Pack 扩展 suite | **99/99 PASS** |
| 全量 `npm test` | **1179/1179 PASS** |

---

## 反模式审查（qa-plan + Windows 7.9 专项）

| 反模式 | 结果 | 证据 |
|--------|------|------|
| **重试失控**（无限/无界等待） | PASS | 最多 5 次 rename；退避 capped 370ms 累计 |
| **静默吞错**（持久化失败伪装成功） | PASS | `throw renamed.error`；单测 + code-review 隔离注入 |
| **旧数据丢失**（rename 失败破坏 store） | PASS | 同目录 tmp→rename，不先 unlink 目标；失败旧 JSON 可读 |
| **临时文件残留** | PASS | 随机 `pid+hex` tmp；失败 best-effort `rmSync` |
| Skill 文本声称跳过授权/审批，宿主仍阻断 | PASS | `skill-experience.test.js`；Electron 未授权不调用 LLM |
| required tool 不存在时不伪造已读取 | PASS | B4 task-scoped grounding + OutputGate |
| imported Pack `../` catalog root 被拒绝 | PASS | `capability-pack.test.js` |
| malformed extension 不拖垮合法 Skill | PASS | `skill-experience.test.js` |
| 动态目录失败时 legacy 仍可用 | PASS | `skill-task-ui.test.js` + Electron `legacy-scene-fallback` |
| 多 Pack 重复 task/Skill ID 确定性告警 | PASS | B5 `duplicate_task_id` |
| Pack ID 越界删除 / 复制残包 / bundled 依赖绕过（B1–B3） | PASS | 见 B1–B8 |
| Pack-owned writing/general task 被静默隐藏（B6/B8） | PASS | Electron 15/15 + skill-task-ui 单测 |
| **硬编码入口回归**（Windows 修复误改 Renderer） | PASS | 7.9 仅主进程 store；Smoke/UI 证据未回归 |

**反模式发现：无 BLOCKING。**

### ADVISORY（不阻塞 story-done）

- code-review Windows follow-up 建议：重试耗尽 / 不可重试错误 / tmp 清理与旧 store 保留尚未固化为长期单测（本轮 code-review 已隔离验证；现有单测覆盖瞬时 EPERM 成功路径）。
- code-review A1–A3 仍为非阻塞建议项（见第二轮报告）。

---

## 外部依赖 / 留测项（非 BLOCKING）

| 项 | 状态 | 说明 |
|----|------|------|
| 授权飞书后四任务 E2E | **留测** | 需本机 lark-cli 授权；grounding/缺工具阻断已由单测覆盖 |
| 写作四卡 → 缺素材追问 → 补素材续跑 | **留测** | material preflight 单测 PASS；Electron 4 卡入口已验 |
| Ctrl+K 与空状态同一 task preflight 等价性手测 | **单测等效 PASS** | 同一 task DTO + `mapPreflightSpec` |
| live 修改 sidecar title → refresh catalog | **留测** | DTO 合并逻辑单测已覆盖 |

---

## 与第二轮 QA 差异说明

| 项 | 第二轮 QA | 第三轮最终 QA |
|----|-----------|---------------|
| 全量测试 | 1178/1178 | **1179/1179**（+1 capability-store 重试回归） |
| Windows atomic rename | 未专项 | **task 7.9 专项 PASS**（20/20 store 定向） |
| 制作人验收轮次 | 第二轮 | **第三轮**（含 Windows 稳定性说明） |
| Electron 冒烟 | 15/15 | **15/15 沿用**（UI 路径未变） |
| BLOCKING | 无 | **无** |

---

## 证据目录

| 路径 | 说明 |
|------|------|
| `evidence/test-report.md` | 本报告（第三轮最终 QA） |
| `evidence/skill-driven-electron-smoke.json` | Electron 15/15 |
| `evidence/dev-self-test.md` | 开发自测（含 7.9） |
| `evidence/screenshots/` | general 5 卡 / writing 4 卡 / 未授权 preflight |
| `acceptance.md` | 制作人第三轮验收 |
| `code-review.md` | B1–B8 终审 + Windows follow-up PASS |

---

## 结论

- [x] **通过，可进入 `/gate-check` → `/story-done`**
- [ ] 不通过，打回开发

**总结**：在 B1–B8 修复、制作人第三轮验收与 Windows atomic rename（task 7.9）落地后，QA 第三轮独立复测全部硬门禁通过。`capability-store.js` 的有界重试、随机 tmp、失败清理与抛错经源码核对 + 20/20 定向回归 + 新单测覆盖；Skill/Pack/UI 契约 99/99 无回归；反模式专项（重试失控/静默吞错/旧数据丢失/tmp 残留/硬编码入口）均无 BLOCKING。授权后真实飞书 E2E 与部分交互链诚实留测。与 `code-review.md`、`acceptance.md` 结论一致。
