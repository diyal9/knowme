# QA Plan: harden-workbench-tool-surface-runtime

## Smoke Scope（必填）

- [x] **H1** Agent Run v1 经唯一 resolver；legacy 回退无 v1 写工具（单测 + eval 子集）
- [x] **H2** 父 Run cancel ≤3s 子 Run CANCELLED；Electron mock delegate smoke 无泄漏
- [x] **H3** start_process 任意 PowerShell/node 注入负例 100% 拒绝；与 sandbox 策略一致
- [x] **M1** localhost/127.0.0.1/192.168.x **100%** `scope_denied`；0 次 blocked→`approval_required`
- [x] **M2** 渲染 IPC 传 fakeApply 被 strip；test seam 仅 KNOWME_TEST_SEAM
- [x] **M3** 快速连点 + 双窗口批准：1 次 apply；第二次 `not_pending`
- [x] **M4** move 失败双向 rollback 单测 pass
- [x] **M5** mkdir 内容源内直建：0 draft + 时间线含路径与「低风险直建」
- [x] **M6** 过期 task/artifact/run id 返回可读 expired/not_found
- [x] **L1** audit 含 hash chain；token 日志 0 明文
- [x] **L4** 审批卡 summary 含 path/标题；rollback 按钮可用；pending loading
- [x] 拒绝 draft 0 外部写（fake spy）
- [x] 活跃 change 隔离：6 路径无 touch
- [x] 硬门禁：`npm test` + `npm run lint` + harness gate

## Regression Scope

- [ ] `strengthen-workbench-tool-surface` 闭环 eval `tool-surface-closed-loop` 仍 100%
- [ ] Tool Contract 100% 覆盖未退化
- [ ] 既有 Electron IPC approve/reject roundtrip 仍 pass
- [ ] `KNOWME_TOOL_SURFACE=legacy` 行为未破坏

## Anti-pattern Checks（交给测试）

| ID | 反模式 | 预期 | 级别 |
|---|---|---|---|
| AP1 | 快速连点批准 | 1 次 apply | BLOCKING |
| AP2 | 跨窗口双批准 | 第二次 not_pending | BLOCKING |
| AP3 | 拒绝 draft | 0 副作用 | BLOCKING |
| AP4 | Run cancel 后子任务仍跑 | ≤3s 全 cancelled | BLOCKING |
| AP5 | PowerShell `-Command` 注入 | scope_denied | BLOCKING |
| AP6 | `node -e` 注入 | 拒绝 | BLOCKING |
| AP7 | localhost/内网导航 | scope_denied 非 approval | BLOCKING |
| AP8 | OAuth token 进日志 | [REDACTED] | BLOCKING |
| AP9 | move 半失败 | 双向恢复 | BLOCKING |
| AP10 | mkdir 直建无反馈 | 时间线路径+标签 | BLOCKING |
| AP11 | store 超 cap | LRU 无 crash | BLOCKING |
| AP12 | 重启查旧 task id | expired 文案 | BLOCKING |
| AP13 | Hub 安装指引点击 | 打开有效 URL | ADVISORY |
| AP14 | live Agent 审批 IPC | roundtrip pass | ADVISORY |
| AP15 | legacy 回退 | 无 write 投影 | BLOCKING |

## 真实环境边界

| 项 | CI/fake | manual/UAT | SKIP 条件 |
|---|---|---|---|
| 飞书真 apply | fake-feishu 覆盖 | `manual-feishu-apply-probe.js` | `FEISHU_CONFIG=NO` |
| Playwright MCP navigate+snapshot | browser adapter 单测 | `manual-playwright-mcp-probe.js` | `MCP_DIR=NO` |
| live Agent apply_patch→批准 | IPC/eval 覆盖逻辑 | 可选 UAT | 无 LLM 凭据 |
| live 子 Agent delegate cancel | mock E2E | 可选 UAT | — |

**禁止**：无凭据伪造 PASS。

## 证据路径

- `evidence/dev-self-test.md`
- `evidence/test-report.md`
- `evidence/tester-harden-anti-pattern-checks.json`
- `evidence/cancel-subrun-electron-smoke.json`
- `evidence/harden-tool-surface-electron-smoke.json`
- `evidence/phase-gates.json`
- `evidence/manual-*-probe.json`（SKIP 记录）

## 阶段门禁

| 阶段 | 负责人 | 门禁 |
|---|---|---|
| P1 完成 | 开发 | test+lint；H1–H3 单测 |
| P2 完成 | 开发 | M1–M6 单测 + 反模式 |
| P3 完成 | 开发 | L1–L4 + Electron smoke |
| 开发自测 | 开发 | dev-self-test.md |
| 体验验收 | 制作人 | acceptance.md |
| 正式 QA | 测试 | test-report.md + code-review |
| Story 完成 | 全员 | `/gate-check` → `/story-done` |
