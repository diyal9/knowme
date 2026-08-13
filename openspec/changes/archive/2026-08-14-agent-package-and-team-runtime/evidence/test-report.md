# 测试报告: agent-package-and-team-runtime

- **角色**：测试（Tester）
- **日期**：2026-08-07
- **前置**：开发自测 PASS + 制作人验收 PASS（`acceptance.md`）
- **Change**：Agent Package and Team Runtime

## 门禁

| 级别 | 检查项 | 结果 | 证据 / 命令 |
|------|--------|------|-------------|
| 硬 | `npm test` | **PASS** | 1391/1391（最终复跑 2026-08-07） |
| 硬 | `npm run lint` | **PASS** | lint ok + script-scope ok |
| 硬 | Agent Conversation Eval | **PASS** | 8/8（`evidence/eval-report.json`） |
| 硬 | Team Runtime 套件 | **PASS** | 88/88（`cancel-recovery-smoke.json` / `orchestration-e2e.json`） |
| 硬 | Electron Run 树 smoke | **PASS** | 13/13（`agent-team-runtime-electron-smoke.json`） |
| 硬 | Agent Service loopback E2E | **PASS** | 6/6（`agent-service-daemon-e2e.json`，cancel 2ms） |
| 硬 | `npm run harness:gate` | **PASS** | Story 完成门禁 blocking 全绿 |
| 软 | qa-plan Smoke Scope | **已执行** | 见下表；自动化 + 证据核验 |
| 软 | code-review | **已完成** | `code-review.md`（B1 已修复，无剩余 BLOCKING） |

## Smoke Scope 结果

| 用例 | 结果 | 验证方式 | 备注 |
|------|------|----------|------|
| 跨 Builder Agent Package 导入与 Team Workflow | PASS | `agent-team-workflow-runner.test.js` + fixture `tests/fixtures/agent-team-runtime/`；`orchestration-e2e.json` → `crossBuilderAdapters: true` | 契约层覆盖；C 端导入向导见 ADVISORY A1 |
| 父 Run 委派真实子 Run（独立 Session / Expert / 工具子集） | PASS | integration `parent executor orchestrates delegate…`；`realChildExecutor: true` | 占位 `spawnSubRun` 已移除；`fake_spawn_rejected` |
| 串行 handoff、有限并行 join、错误上浮、gate rollback | PASS | workflow runner `runs serial handoff, one gate rollback, parallel join…`；`serialHandoffParallelJoin` / `errorPropagation` | |
| 父 Run 取消 ≤3s，running leak = 0 | PASS | integration `parent cancel propagates within 3s…`；`cascadeUnderThreeSeconds: true`；daemon cancel 2ms | Live 取消动效见 ADVISORY A2 |
| 重启后可查 Event Log，恢复 checkpoint 或 INTERRUPTED | PASS | core `loadFromStore marks non-terminal runs interrupted`；`interruptedRecovery` / `safeResume: true` | |
| draft → approve → applied；恢复/双击不重复副作用 | PASS | core `writeReceipt is idempotent`；governance-ui approval envelope；`idempotentReceipt: true` | |
| Run 时间线：Agent / handoff / 审批 / Artifact / Evidence / 预算 / 停止原因 | PASS | Electron smoke 13 checks + 截图；governance-ui Run 树投影单测 | `screenshots/agent-team-runtime-run-tree.png` |
| 未授权工具、未知协议、无证据事实、提示词注入 fail-closed | PASS | `scope_denied` / `PROTOCOL_VERSION_UNSUPPORTED` / grounding blocked eval / `promptInjection: true` | 见「反模式专项」 |
| 控制台无 uncaught error；终答不展示工具轮草稿 | PASS | Electron `console-error-free`；`outputPrivacy: true`；`diagnosticsCount: 0` | |

## Regression / 自动化覆盖

| 套件 | QA 复跑 | 结果 |
|------|---------|------|
| 全量 `npm test` | 2026-08-07 | 1391/1391 |
| Team Runtime 四文件 | `runtime-production-gates.js` 刷新 | 88/88 |
| Conversation Eval | `npm run test:agent-eval` | 8/8 |
| Loopback Daemon E2E | `evidence/agent-service-daemon-e2e.js` | 6/6 |
| Electron fixture smoke | `evidence/agent-team-runtime-electron-smoke.js` | 13/13 |

## 反模式专项（qa-plan 关注点）

| 关注点 | 反模式 / 手段 | 预期 | 实际 | 结果 |
|--------|---------------|------|------|------|
| 快速取消 | 父 Run 运行中触发 cancel cascade | ≤3s 子树终止，无泄漏 | integration 计时 + `runningLeakCount=0`；remote cancel 2ms | PASS |
| 失败 backend | 注册未知 launcher backend | 可行动错误，不假成功 | `notifies waiters immediately when a child backend cannot launch` | PASS |
| 超大 handoff | payload >32KB | 拒绝并 fail-closed | `rejects handoff payloads over 32KB`；边界 32KB 通过 | PASS |
| 未知协议 | protocolVersion 99 | handshake 拒绝 | `PROTOCOL_VERSION_UNSUPPORTED` | PASS |
| 未授权工具 | 调用 allowlist 外工具 | `scope_denied` | governance-ui validate + execute 双测 | PASS |
| 提示词注入 | 子 Run 输出含注入标记 | 标记不可信，不污染父 answer | bus `promptInjectionSuspected`；UI 安全分区；Electron `hasSecurity` | PASS |
| 重复 terminal / receipt | 重复 finalize / 重复 idempotencyKey | terminal exactly-once；receipt 幂等 | `terminalExactlyOnce` / `idempotentReceipt`；Electron `duplicate: 0` | PASS |
| 崩溃恢复 | 模拟进程中断后 load store | INTERRUPTED + 可 safe resume | `interruptedRecovery` / `safeResume` | PASS |
| 并行 join | parallel cap + waitForChildren | cap 超限拒绝；全部 terminal 后 join | scheduler parallel cap + workflow runner join | PASS |
| 审批等待 | 写操作需 approval | WAITING/UI lane，不误报完成 | `approvalGovernance: true`；Electron `hasApproval`；choice 不进 answer lane | PASS |
| Run 树隐私 | 子 Run 进度 / 工具草稿 | 默认摘要；answer 仅终态 commit | `outputPrivacy: true`；`answer-committed`；子进度不进 answer bubble | PASS |
| 控制台错误 | Electron 加载 + fixture 回放 | 无 uncaught console.error | `consoleErrors: []` | PASS |

## 外部 Workbench live smoke 判定

**结论：ADVISORY（环境/范围），非本 change BLOCKER。**

依据 `evidence/daemon-live-e2e.json`：

| 步骤 | 结果 | 说明 |
|------|------|------|
| `failurePath.executorFail` | PASS | 故意短 brief（10 字符）被脚本拒绝，符合 fail-closed 预期 |
| `successPath.terminal` | FAIL | 选用 workflow `inruntime-cases`，cursor-agent 进入 `need_input`，等待人工澄清（14400s timeout） |
| `successPath.artifacts` | FAIL | 同上，任务未终态故产物不完整 |
| bootstrap status | token/daemon 未就绪 | 外部 Workbench 环境项，非 KnowMe Runtime 契约 |

**根因分析**：

1. 成功路径选用了需人工输入的 demo workflow（`inruntime-cases`），非 Team Runtime 生产路径 smoke。
2. 失败路径反而验证了 handoff 校验与外部脚本 fail-closed，与本 Story 安全目标一致。
3. 本 change 的 Agent Service **契约**已由 loopback HTTP E2E 6/6 覆盖；制作人 acceptance **A3** 已标注 daemon live 不阻塞。
4. 该 live 任务已取消，不影响 Story 范围内 Runtime / Run 树 / 编排门禁。

## 反模式发现

### [ADVISORY] A1 — Package 导入 C 端 UI 未进 Electron smoke

- **反模式**：用户从能力页导入 Package，期望可视化 manifest 错误
- **预期**：导入向导展示能力、版本、权限
- **实际**：契约层 + manifest 校验与 Run 树 Builder 标签覆盖；无专用导入面 smoke
- **证据**：`acceptance.md` A1；Electron smoke 为 fixture Run 树
- **建议**：后续 Story 补导入向导；或 `align-workbench-workflow-catalog` 跟进

### [ADVISORY] A2 — Live 父 Run 取消动效未录制

- **反模式**：运行中快速连点取消
- **预期**：UI ≤3s 收敛到 CANCELLED
- **实际**：3s 预算由 88 项 Team Runtime 测试 + cancel 控件存在性证明；fixture smoke 未录 live 动画
- **证据**：`acceptance.md` A2；integration cancel 测试

### [ADVISORY] A3 — Workbench daemon live E2E 未全绿

- **反模式**：外部 Workbench 全链路 demo
- **预期**：可选增强证据
- **实际**：`daemon-live-e2e.json` ok=false；loopback 协议 E2E 已 PASS
- **证据**：`daemon-live-e2e.json`；见上文判定

## Blocker

**无。** 范围内未发现需打回开发的 BLOCKING 缺陷。

## 结论

- [x] **通过，可 `/story-done`**
- [ ] 不通过，打回开发

**摘要**：QA 独立复跑全部硬门禁（1391 测、lint、Eval 8/8、Team Runtime 88/88、Electron 13/13、loopback Daemon 6/6）均 PASS。Smoke Scope 与反模式专项均由自动化测试 + 既有 evidence 交叉核验；Workbench 外部 live smoke 因错误 workflow 与人工等待失败，判定为 **ADVISORY / 环境**，不阻塞本 Story。遗留 A1–A3 均为体验或外部环境增强项，可在归档后由后续 change 消化。

## 证据目录

- `evidence/eval-report.json`
- `evidence/orchestration-e2e.json`
- `evidence/cancel-recovery-smoke.json`
- `evidence/agent-team-runtime-electron-smoke.json`
- `evidence/agent-service-daemon-e2e.json`
- `evidence/daemon-live-e2e.json`（外部，advisory）
- `evidence/screenshots/agent-team-runtime-run-tree.png`
- `acceptance.md` / `code-review.md` / `dev-self-test.md`

**测试签字**：Tester · 2026-08-07
