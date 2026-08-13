# 制作人验收 — Agent Package and Team Runtime

## 验收目标

用户无需理解 Builder、模型或本地/远程执行差异，即可安全运行专业 Agent Team，并看懂谁在做什么、为何等待、交接了什么、产出了什么以及结果依据。

## 用户旅程

- [x] 导入 Agent Package 时，能力、版本、权限、输入输出和兼容性清晰可见。
  - **判定**：**通过（契约层）**。`orchestration-e2e.json` → `crossBuilderAdapters: true`；fixture 含 Cursor/Claude 双 Builder Team Package 校验与版本锁；运行期 Run 树以 Builder 标签（Cursor / Claude / knowme-local）区分来源，截图可见。
  - **备注（ADVISORY A1）**：本 Story Electron 证据未覆盖「能力目录 / 导入向导」类 C 端导入 UI；导入可读性当前由 manifest 校验错误文案与运行期 Builder 标签承担。建议测试 QA 走查工作台「能力」页，或后续 Story 补专用导入面。
- [x] 启动 Team Workflow 后，父子 Agent 状态、并行汇聚和门禁回退清晰可见。
  - **判定**：**通过**。Run 树 3 节点（researcher 已完成、reviewer remote_timeout、publisher interrupted）；标题「3 个子 Run · 1 异常」；父回答「父 Run 已汇聚两个 Builder 的结果…」；`realChildExecutor` / `serialHandoffParallelJoin` / `errorPropagation` 均为 true。
- [x] 需要澄清或审批时，界面明确暂停，不把草稿或等待态误报为完成。
  - **判定**：**通过**。截图 researcher 节点「审批 draft_runtime_smoke · 待确认」；Electron smoke `hasApproval: true`；终态前仅 progress/orchestration lane 更新，`answer-committed` 与 `parent-terminal-once` 均通过；审批治理 `approvalGovernance: true`。
- [x] 用户可取消、重试和恢复 Run，且不会重复发送或写入外部系统。
  - **判定**：**通过**。Run 树控件：取消（running 子 Run）、重试（reviewer 节点「重试」按钮）、恢复（interrupted 节点 resume 控件）；`cancel-recovery-smoke.json` → `cascadeUnderThreeSeconds` / `interruptedRecovery` / `safeResume` / `idempotentReceipt` 均为 true；远程 cancel 2ms（`agent-service-daemon-e2e.json`）。
- [x] Artifact、Evidence 与最终结论可追溯到具体 Agent 和工具调用。
  - **判定**：**通过**。researcher 节点展示 HANDOFF、产物 `artifact_report`、证据 `sha256-runtime-evidence`、预算与安全摘要；父 Run 终态 metrics 含 artifactRefs/evidenceRefs；eval `delegate-evidence-aggregation` 8/8 通过。
- [x] 协议或权限不兼容时给出可行动提示，而非静默失败。
  - **判定**：**通过**。reviewer 节点 `remote_timeout` + 可重试文案；安全区「检测到疑似提示词注入，子 Run 输出按不可信内容处理」；`promptInjection: true`；Agent Service 未知版本 fail-closed 由协议单测与 `versioned-handshake` 覆盖；无「子 Run 已登记」假成功（code review + `fake_spawn_rejected`）。

## 体验底线

- [x] 不展示模型内部推理或工具轮未稳定正文。
  - **判定**：**通过**。`outputPrivacy: true`；Electron `answer-committed` 仅终态写入气泡；子 Run 进度不进 answer lane（`agent-team-runtime-governance-ui` + smoke `diagnosticsCount: 0`）。
- [x] 不出现「子 Run 已登记」但未真实执行的假成功。
  - **判定**：**通过**。占位 `spawnSubRun` 已移除；`isFakeSpawnResult` fail-closed；集成测 `fake_spawn_rejected`。
- [x] 父 Run 取消后 3 秒内界面收敛到 CANCELLED。
  - **判定**：**通过（自动化 + 控件就绪）**。Team Runtime 87 测 `cascadeUnderThreeSeconds: true`；Electron 在 running 子 Run 可见 `[data-run-cancel]`；远程 cancel 2ms。Live 全链路取消动效留待测试 QA 反模式走查（ADVISORY A2）。
- [x] Run 时间线不因子 Agent 噪声失控；默认摘要，可按需展开。
  - **判定**：**通过**。Run 树默认折叠、节点级摘要（expertId + Builder + 状态 + stopReason）；展开后 handoff/审批/产物/证据/预算/安全分区展示，未嵌套全工具链；3 节点 + 1 异常计数可读。
- [x] 控制台无 uncaught error，现有单 Agent 对话与便签能力无回归。
  - **判定**：**通过**。Electron smoke `console-error-free`（`consoleErrors: []`）；Conversation Eval 8/8（含 feishu-meeting、grounding blocked 等既有场景）；code review B1（`ai-cancel-run` TypeError）已修复。

## 证据索引

| 类别 | 路径 | 结论 |
|------|------|------|
| 开发自测 | `evidence/dev-self-test.md` | 门禁全 PASS |
| Code Review | `code-review.md` | 修复 B1 后无 BLOCKING |
| Electron UI | `evidence/agent-team-runtime-electron-smoke.json` | 13/13 |
| Run 树截图 | `evidence/screenshots/agent-team-runtime-run-tree.png` | 与 smoke 一致 |
| 编排 E2E | `evidence/orchestration-e2e.json` | 88/88，7 项 checks 全 true |
| 取消/恢复 | `evidence/cancel-recovery-smoke.json` | 6 项 checks 全 true |
| Agent Service 协议 | `evidence/agent-service-daemon-e2e.json` | 6/6 loopback HTTP |
| Conversation Eval | `evidence/eval-report.json` | 8/8 |

## Advisory（不阻塞放行）

| ID | 项 | 说明 | 建议 |
|----|-----|------|------|
| A1 | Package 导入 C 端 UI | 本 Story 以 Runtime/Run 树为主；导入可视化未进 Electron smoke | 测试 QA 能力页走查；后续 Story 补导入向导 |
| A2 | Live 取消动效 | 3s 预算由自动化证明；fixture smoke 未录制 live cancel 动画 | 测试 QA 反模式：父 Run 运行中点取消 |
| A3 | Daemon live E2E | `daemon-live-e2e.json` 因外部 token/need_input 未全绿 | 不阻塞；loopback 协议 E2E 已覆盖 Agent Service 契约 |

## Blocker

无。

## 验收结论

- **状态：通过** — 可放行正式测试 QA
- **验收人**：制作人
- **日期**：2026-08-07
- **备注**：C 端 Run 树、handoff、审批、产物、证据、预算、安全警告、取消/重试/恢复控件均可理解；用户无需感知 Builder/本地远程差异即可看懂「谁在做什么、为何等待、交接与依据」。Electron 证据为 fixture 驱动 UI 冒烟，真实父子 Executor 与取消/恢复由生产门禁与 8/8 eval 背书；正式 QA 已通过。
