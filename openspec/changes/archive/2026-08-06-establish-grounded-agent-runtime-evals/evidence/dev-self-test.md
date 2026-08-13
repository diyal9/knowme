# 开发自测报告

- 日期：2026-08-05（QA ADVISORY 收尾轮）
- Change：`establish-grounded-agent-runtime-evals`
- tasks：**40/40**（7.5、8.3 已补齐）

## QA ADVISORY 修复

| ID | 问题 | 修复 | 证据 |
|---|---|---|---|
| **A1** | violation 附注暴露 `feishu.meeting_read` | `formatViolationForUser` + `GroundingUI.renderGroundingStatusMetaHtml`；`buildGroundingStatus` 增加 `userMessage` | `grounding-ui-fixture-smoke.json` → `blocked-no-raw-tool-in-bubble: true` |
| **A2** | `renderChat()` 全量刷新丢失 `<details open>` | `capture/restoreGroundingDetailsOpenState`；stream done 改增量 `refreshAssistantProgress`；`patchAssistantGroundingMeta` | `details-open-survives-rerender: true` |

## 门禁命令

| 命令 | 结果 |
|---|---|
| `npm test` | **PASS** — **1011/1011** |
| `npm run lint` | **PASS** |
| Conversation Eval | **PASS** — 7/7 |
| `grounding-meeting-e2e.js` | **PASS** — 全层 checks 绿 |
| ReadLints | 无 error |

## Task 7.5 / 8.3 实际执行

**可接受标准（等价 E2E，无伪造）**：

| 层 | 内容 | 证据 |
|---|---|---|
| Executor | `feishu-meeting-pick-2-no-tool` blocked + happy verified | `grounding-meeting-e2e.json` layers.executor |
| 飞书只读 API | production `executeMeetingCandidates` + 候选 #2 `executeMeetingRead` | `feishu-readonly-meeting-probe.json`（7 候选，bodyLen=8635，仅哈希） |
| Renderer | production `GroundingUI` + Electron 截图 | `grounding-ui-fixture-smoke.json` + screenshots |
| Electron 启动 | 无业务 console error | `grounding-electron-smoke.json` |

**说明**：未使用在线 LLM 驱动完整 Electron 对话（不可控/无 fixture hook）；等价覆盖同一 **AgentRunExecutor + feishu-cli + GroundingUI** 生产链。QA 已接受此等价标准。

### 截图

- `evidence/screenshots/workspace-load.png`
- `evidence/screenshots/meeting-blocked.png`
- `evidence/screenshots/meeting-verified.png`

## 新增/扩展测试

| 文件 | 用例 |
|---|---|
| `tests/agent-grounding-labels.test.js` | 7（violation 友好化、buildGroundingStatus.userMessage） |
| `tests/agent-grounding-ui.test.js` | 2（details capture/restore、patch 保 open） |

## 主要改动文件

- `src/lib/agent-grounding-labels.js` — `formatViolationForUser`
- `src/lib/agent-grounding-ui.js` — meta 渲染 + details 状态（IIFE，兼容 page-script-scope）
- `src/lib/agent-grounding-runtime.js` — `buildGroundingStatus.userMessage`
- `src/workspace-agent.js` — GroundingUI 委托、renderChat 保 open、stream done 增量
- `scripts/feishu-readonly-meeting-probe.js` — production feishu-cli 探针
- `evidence/grounding-meeting-e2e.js` — 7.5/8.3 编排

## 是否可提交制作人 focused re-UAT

**是** — A1/A2 已修复并有自动化证据；tasks 40/40；等价 E2E 全绿。建议制作人 spot-check 真实 LLM 会议对话（可选，非 blocking）。
