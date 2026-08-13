# 测试报告: refactor-agent-multistage-output-pipeline

- **测试人**：Tester
- **日期**：2026-08-06
- **前置**：开发自测 PASS（`evidence/dev-self-test.md`）；制作人验收 PASS（`acceptance.md`）；独立 code review PASS / APPROVED（`code-review.md` B1–B7 RESOLVED）

## 门禁

| 项 | 级别 | 结果 | 证据 |
|---|---|---|---|
| `npm test` | 硬 | **PASS** 1271/1271 | 本机独立复跑 |
| `npm run lint` | 硬 | **PASS** | `lint ok`、`script-scope ok` |
| `openspec validate … --strict` | 硬 | **PASS** | Change is valid |
| `node .cursor/scripts/harness.js gate --json` | 硬 | **PASS** | `blocking: false` |
| qa-plan Smoke Scope | 软 | **已执行并勾选** | 本报告 Smoke 表 |
| code-review | 软 | **已完成** | `code-review.md` 最终 APPROVED |

## 独立定向回归（qa-plan 自动化 + 制作人 ADVISORY 补验）

| 命令 / 套件 | 结果 | 备注 |
|---|---|---|
| `node --test tests/agent-output-protocol.test.js tests/agent-output-assembler.test.js tests/agent-message-state.test.js tests/agent-run-executor.test.js tests/agent-streaming-integration.test.js tests/agent-suggestion.test.js tests/agent-output-blocking-fixes.test.js tests/agent-legacy-session-ui.test.js` | **PASS** 86/86 | B1–B7 负例 + 旧会话 + suggestion |
| `node --test tests/agent-output-fixture.test.js tests/agent-stream-repaint.test.js` | **PASS** 15/15 | fixture 契约、增量 repaint、表格流式 |
| `node openspec/changes/…/evidence/agent-output-electron-smoke.js` | **PASS** 10/10 checks | `mode=electron`、IPC 18/18、`scrollDriftPx=0` |

## Smoke 结果

| Smoke Scope 条目 | 结果 | 验证方式 |
|---|---|---|
| 工具轮 prose 不进回答区；过程可见 | **PASS** | Electron smoke + 截图 `running-progress.png`；`agent-run-executor` 工具轮缓冲丢弃 prose |
| canonical 提交后稳定、无覆盖 | **PASS** | smoke `canonical-hash-stable`（rollbackCount=0）；B1 invoke 无 `text` 字段 |
| suggestion / bare / 半截 / 非法 JSON 零泄漏 | **PASS** | smoke `visible-raw-json-zero`（0 ms）；`agent-suggestion` 17 项；B4 半截/单字段 thinking 负例 |
| 结构化选择进独立按钮区 | **PASS** | smoke `choice-in-structured-ui`；截图 `canonical-choice.png`「1 继续分析」 |
| 重复/乱序幂等；terminal 后冻结 | **PASS** | smoke `terminal-once-no-duplicate-late-dom`（duplicateLateDomUpdates=0）；`agent-message-state` duplicate/late/gap |
| 历史/气泡/正文节点身份稳定 | **PASS** | smoke `history-bubble-body-same-node`；B5 固定 shell + strict `isSameNode` |
| 上滑后不抢滚动 | **PASS** | smoke `scroll-drift-under-8px`（drift=0 px）；截图 helper 用 fixed clone 不污染 scroll |
| pending review 终态仍可操作 | **PASS** | smoke `pending-review-timeline-open`；截图 `terminal-pending-review.png` |
| cancelled / error / completed 可区分、IPC 可克隆 | **PASS** | `agent-run-executor` CANCELLED 信号；B2 postProcess/persist/terminal emit 均恰 1 个 terminal；`structuredClone(result)` 断言 |
| 旧会话兼容；新会话 hash/ui/version | **PASS** | `agent-legacy-session-ui` 5/5；B6 `open_link` round-trip |
| 长 Markdown / 表格 / 代码块 + choices 布局 | **PASS（间接）** | `agent-stream-repaint` 表格 `table-layout:fixed`、增量 markdown；smoke 含 choice + 正文 + 时间线组合；**无专用超长 fixture 截图** |
| 不展示 reasoning / 协议字段 / 敏感工具原文 | **PASS** | B3/B4；smoke `metrics-no-sensitive-fields` |

## Regression（制作人 ADVISORY 补验）

| 关注点 | 结果 | 证据 |
|---|---|---|
| cancel/error 收敛 | **PASS** | `transitions to CANCELLED when signal aborted`；B2 三路径均 `terminals.length === 1`；terminal emit 失败 → 唯一 `run.failed` |
| 旧会话 lazy hydration | **PASS** | `agent-legacy-session-ui`：fenced/bare/incomplete suggestion 剥离，structured UI 分离渲染 |
| 半截 / bare thinking 与 suggestion | **PASS** | B4 精确负例三则 + `analysis` 保留；assembler `strips incomplete suggestion fences` |
| terminal emit 异常 | **PASS** | B2 `completed emitter throw falls back to one run.failed terminal` |
| 快速重复 / 乱序事件 | **PASS** | smoke 注入 duplicate + late；reducer counters + DOM 0 额外更新 |
| structured UI + pending review | **PASS** | DOM 断言 approve/reject 可见；`keeps pending review actionable after terminal` |
| 真实 LLM 全链路 | **未测（ADVISORY）** | 仍为受控 v2 fixture IPC；见下方发现 #1 |

## 反模式发现

### [ADVISORY] Electron smoke 为受控 fixture，非 live LLM 全链路

- **反模式**：仅依赖手工 v2 事件序列验证 UX，不经 `ai-generate` → 真实模型/工具。
- **预期**：生产 Run 与 fixture 行为一致。
- **实际**：fixture + 1271 单测 + IPC 契约已覆盖协议层；**真实 pending_review 批准/拒绝真机路径未在本轮执行**。
- **证据**：`agent-output-electron-smoke.js` `buildScenario()`；制作人 `acceptance.md` ADVISORY #1。

### [ADVISORY] 取消/失败终态无 Electron 截图

- **反模式**：仅单元/集成测试覆盖 cancelled/failed UI。
- **预期**：终态视觉可归档、可回归比对。
- **实际**：逻辑 PASS（CANCELLED 事件、run.failed 收敛）；**无 cancelled.png / failed.png**。
- **证据**：`agent-run-executor.test.js` CANCELLED；B2 terminal 负例；截图目录仅 3 张 happy path。

### [ADVISORY] 长 Markdown/表格组合无专用 smoke 截图

- **反模式**：smoke canonical 正文为短句，未压测超长表格+代码块+choices 同屏。
- **预期**：复杂排版不挤爆 structured UI / 时间线。
- **实际**：`agent-stream-repaint` 与 `workspace-agent` 表格流式单测 PASS；**正式 QA 未追加视觉证据**。
- **证据**：`workspace-agent.test.js` coalesces stream paints / table-layout:fixed。

### [ADVISORY] running 阶段首屏无逐字正文（设计取舍）

- **反模式**：用户等待时仅见执行进度、不见正文草稿。
- **预期**：阶段文案足够安抚等待感。
- **实际**：符合 proposal/design 稳定缓冲策略；截图 `running-progress.png` 仅进度区。
- **证据**：制作人 acceptance ADVISORY #2。

### BLOCKING

无。

## 定量门槛核对

| 指标 | 门槛 | 实测 |
|---|---|---|
| raw JSON 用户可见时长 | 0 ms | 0 ms（smoke） |
| canonical 正文回滚 | 0 次 | rollbackCount=0 |
| 历史节点 isSameNode | 100% | smoke PASS |
| 非 stick scroll 漂移 | < 8 px | 0 px |
| duplicate/late DOM 更新 | 0 次 | 0 |
| 每 Run terminal 事件 | 恰好 1 | terminalDomUpdates=1 |

## 证据清单

- 自动化 JSON：`evidence/agent-output-electron-smoke.json`（Tester 复跑 2026-08-06T10:06:52Z）
- 截图：
  - `evidence/screenshots/running-progress.png`
  - `evidence/screenshots/canonical-choice.png`
  - `evidence/screenshots/terminal-pending-review.png`
- 审查：`code-review.md`（最终 PASS / APPROVED）
- 验收：`acceptance.md`（制作人放行）

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**说明**：独立复跑全量门禁 1271/1271、lint、strict validate、harness gate 均 PASS；定向 86+15 项回归与 Electron IPC smoke 10/10 全绿。Smoke Scope 12 项均已执行并勾选。无 BLOCKING；4 项 ADVISORY 与制作人验收一致，建议后续 story 或 live 回归补 cancelled/failed 截图与真实 pending_review 真机路径，**不阻断本 change 归档**。
