# 测试报告: establish-grounded-agent-runtime-evals

- 日期：2026-08-06
- 角色：正式测试（Tester · focused re-test）
- 前置：制作人 UAT-3 PASS；开发修复 A1/A2；tasks **40/40**

## 门禁

| 级别 | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 硬 | `npm test` | **PASS** 1011/1011 | QA 独立复跑 2026-08-06 |
| 硬 | `npm run lint` | **PASS** | lint ok + script-scope ok |
| 硬 | Conversation Eval CLI baseline v1 | **PASS** 7/7 | `evidence/eval-report.json` |
| 硬 | Focused grounding suites | **PASS** 23/23 | labels + ui + executor + skill contract |
| 硬 | `grounding-meeting-e2e.js` | **PASS** 17/17 checks | `evidence/grounding-meeting-e2e.json` |
| 软 | qa-plan Smoke Scope | **已执行** | 下表 |
| 软 | code-review | **已完成** | `evidence/code-review.md` |

## A1/A2 复验（上轮 ADVISORY 清零）

### A1 — 用户可见层无 raw tool id

| 检查 | 结果 | 证据 |
|---|---|---|
| `blocked-no-raw-tool-in-bubble` | **PASS (true)** | `grounding-ui-fixture-smoke.json` |
| `blocked-friendly-violation-note` | **PASS** — 「缺少必需读取：飞书会议妙记读取」 | 同上 |
| `renderGroundingStatusMetaHtml` 单测 | **PASS** — HTML 不含 `feishu.meeting_read` | `agent-grounding-labels.test.js` |
| `buildGroundingStatus.userMessage` | **PASS** | runtime 单测 |
| Electron 气泡 innerText 审计 | **PASS** | fixture smoke 独立复跑 |

**判定：A1 已修复，清零。**

### A2 — details open 状态保持

| 检查 | 结果 | 证据 |
|---|---|---|
| `details-open-survives-rerender` | **PASS (true)** | fixture smoke simulate renderChat rebuild |
| `capture/restoreGroundingDetailsOpenState` | **PASS** | `agent-grounding-ui.test.js` |
| `patchAssistantGroundingMeta` 保 open | **PASS** | 同上 |
| `renderChat()` capture→restore | **代码审查 PASS** | `workspace-agent.js` L2646–2703 |
| stream done 增量 `refreshAssistantProgress` | **代码审查 PASS** | grounding-status 非 streaming 时 `patchAssistantGroundingMeta`；streaming 时不渲染 verified badge（L2695） |

**判定：A2 已修复，清零。**

## Smoke / 等价 E2E（tasks 7.5 / 8.3）

| 层 | 结果 | 脱敏证据 |
|---|---|---|
| Executor 事故 blocked | **PASS** | textLen=55；无 forbiddenClaims；status=blocked |
| Executor happy verified | **PASS** | meeting_read ok；digest `2f71bbb214c41ed1` |
| 飞书只读 API | **PASS** | 14 天 7 候选；token hash `fda4ada…` read ok bodyLen=8635 |
| GroundingUI + Electron 截图 | **PASS** | blocked/verified/workspace 三张截图 |
| Electron 启动 | **PASS** | consoleErrors=[] |

**tasks 7.5/8.3 勾选依据**：`grounding-meeting-e2e.json` → `task75Complete: true`、`task83Complete: true`；QA 独立复跑一致。

**未执行（非 BLOCKING）**：在线 LLM 驱动完整 Electron 对话流 — 环境不可控，等价链已覆盖生产模块。

## Regression / 反模式

| 项 | 结果 |
|---|---|
| 7 conversation eval scenarios | PASS |
| 事故 fail-closed | PASS |
| Skill contract（inline/块级/merge/legacy） | PASS |
| Legacy chat 不误杀 | PASS |
| 飞书 scope 失败不编造 | PASS（首 token cli_error 路径） |
| Eval 硬门禁篡改探测 | PASS（上轮 qa-eval-hard-gate-probe 仍有效） |

## 剩余 ADVISORY（非 BLOCKING）

| ID | 说明 | 状态 |
|---|---|---|
| A3 | harness gate 未读 eval 阈值（design 可选） | 仍 OPEN，不阻塞 |
| A4 | autoMatch L0 技能不注入 groundingContract | 仍 OPEN，slash 主路径已覆盖 |
| A5 | 在线 LLM 真实流式 spot-check 未做 | 可选，等价 E2E 已接受 |

## BLOCKING / ADVISORY 汇总

| 级别 | 数量 | 说明 |
|---|---|---|
| **BLOCKING** | **0** | — |
| **ADVISORY（上轮）** | A1、A2 | **已清零** |
| **ADVISORY（遗留）** | A3、A4、A5 | 不阻塞 Story |

## tasks 完成度

- **40/40** — QA 独立核验与 dev/tasks 一致；7.5/8.3 有 `grounding-meeting-e2e.json` 17/17 + 飞书 probe + 截图事实依据

## 结论

- [x] **正式 QA 最终 PASS**
- [x] **可进入 `/gate-check`**
- [ ] 不通过，打回开发

证据目录：`openspec/changes/establish-grounded-agent-runtime-evals/evidence/`  
截图：`evidence/screenshots/`（workspace-load、meeting-blocked、meeting-verified）
