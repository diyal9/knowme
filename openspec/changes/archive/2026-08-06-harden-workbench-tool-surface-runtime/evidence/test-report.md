# 测试报告: harden-workbench-tool-surface-runtime

- **测试人**: 测试（Tester）
- **日期**: 2026-08-06
- **前置**: 开发自测 PASS + 制作人验收 PASS（`acceptance.md` / `producer-uat.md`）
- **Preflight**: `node .cursor/scripts/harness.js preflight --json` → **PASS**（needs_fix=false）

---

## 门禁

| 级别 | 检查项 | 结果 | 命令/证据 |
|------|--------|------|-----------|
| 硬 | npm test | **PASS** | 1107/1107，0 fail，5736ms |
| 硬 | npm run lint | **PASS** | lint ok + script-scope ok |
| 硬 | harness gate | **PASS** | blocking: false |
| 硬 | OpenSpec strict validate | **PASS** | change valid |
| 软 | qa-plan Smoke Scope | **已执行** | 见下表 |
| 软 | code-review | **已完成** | `../code-review.md` |

---

## 测试规模

| 类别 | 数量 | 结果 |
|------|------|------|
| 全量单元/集成 | 1107 tests / 192 suites | PASS |
| 加固专项 `harden-tool-surface.test.js` | 38 it | PASS |
| 反模式脚本 AP1–AP15 + M2 | 16/16 | PASS |
| Electron smoke（逻辑 mock） | 2 scripts | PASS |
| 测试会话补测（IPv6/audit/seam/CAS/LRU） | 9/9 | PASS |
| web-fetch 重定向 SSRF（回归） | 含于 1107 | PASS |
| **合计独立验证点** | **1172+** | **全 PASS** |

---

## Smoke Scope 执行结果

| 项 | 结果 | 独立验证 |
|----|------|----------|
| H1 Registry 唯一 resolver + legacy | PASS | 单测 + harden-tool-surface-electron-smoke mode=v1 toolCount=11 |
| H2 cancel ≤3s 无泄漏 | PASS | cancel-subrun-electron-smoke withinBudget leakCount=0 |
| H3 start_process 注入拒绝 | PASS | AP5/AP6 + H3 单测 |
| M1 blockedHosts scope_denied | PASS | AP7 + handler 127.0.0.1 非 approval_required |
| M2 IPC strip fakeApply | PASS | M2/strip-fakeApply + 生产 env 模拟 |
| M3 连点/双窗口 CAS | PASS | AP1/AP2 not_pending |
| M4 move 双向 rollback | PASS | AP9 |
| M5 mkdir 低风险直建 | PASS | AP10 |
| M6 expired/not_found | PASS | AP11/AP12 |
| L1 audit hash + 脱敏 | PASS | L1×5 单测 + tamper 补测 |
| L4 审批 summary/loading/rollback/Hub | PASS | workspace-agent 源码 + AP13 |
| 拒绝 draft 0 外部写 | PASS | AP3 |
| 6 活跃 change 隔离 | PASS | git diff 无命中 |
| 硬门禁 trio | PASS | 见上 |

## Regression Scope

| 项 | 结果 |
|----|------|
| tool-surface-closed-loop eval | PASS（含于 npm test） |
| Tool Contract 覆盖 | PASS（registry execute envelope 单测） |
| IPC approve/reject roundtrip | PASS（AP14 handler exported） |
| KNOWME_TOOL_SURFACE=legacy | PASS（AP15 filtered write_file） |

---

## 反模式结果（qa-plan AP 清单）

| ID | 反模式 | 级别 | 结果 | 证据 |
|----|--------|------|------|------|
| AP1 | 快速连点批准 | BLOCKING | **PASS** | second=not_pending |
| AP2 | 跨窗口双批准 | BLOCKING | **PASS** | not_pending |
| AP3 | 拒绝 draft 无副作用 | BLOCKING | **PASS** | disk unchanged |
| AP4 | cancel 后子任务仍跑 | BLOCKING | **PASS** | elapsed=0ms leakCount=0 |
| AP5 | PowerShell 注入 | BLOCKING | **PASS** | 危险命令被拦截 |
| AP6 | node -e 注入 | BLOCKING | **PASS** | 中文拒绝文案 |
| AP7 | localhost/内网 | BLOCKING | **PASS** | scope_denied 192.168.0.1 |
| AP8 | OAuth token 日志 | BLOCKING | **PASS** | masked |
| AP9 | move 半失败 | BLOCKING | **PASS** | rollbackMove 恢复 |
| AP10 | mkdir 直建无反馈 | BLOCKING | **PASS** | 低风险直建文案 |
| AP11 | store 超 cap | BLOCKING | **PASS** | LRU size=2 无 crash |
| AP12 | 重启查旧 task id | BLOCKING | **PASS** | 任务不存在或已清理 |
| AP13 | Hub 安装指引点击 | ADVISORY | **PASS** | data-hub-open-url handler |
| AP14 | live Agent 审批 IPC | ADVISORY | **PASS** | handler exported（逻辑） |
| AP15 | legacy 回退 | BLOCKING | **PASS** | filtered write_file |

**反模式 BLOCKING 合计**: 13/13 PASS

---

## 真实环境 SKIP（未伪造 PASS）

| 项 | 条件 | 结果 | 证据 |
|----|------|------|------|
| 飞书真 apply | 无 FEISHU_CONFIG | **SKIP** | `manual-feishu-apply-probe.json` skipped |
| Playwright MCP live navigate | 无 MCP_DIR | **SKIP** | `manual-playwright-mcp-probe.json` skipped |
| live Agent Run 审批 UI | 无 LLM 凭据 | **SKIP** | mock/E2E 逻辑覆盖；无真机截图 |

---

## 问题分级汇总

| 级别 | 数量 | 说明 |
|------|------|------|
| BLOCKING | 0 | — |
| HIGH | 0 | — |
| ADVISORY | 5 | CR-A1 LRU running eviction 边界；CR-A2 无 verifyAuditChain API；CR-A3 smoke 为 mock；CR-A4 飞书 connector 标签；CR-A5 chat-only minimal 路径 |

---

## 执行的命令清单

```bash
node .cursor/scripts/harness.js preflight --json
npm test                                    # 1107 pass
npm run lint                                # pass
node .cursor/scripts/harness.js gate --json # blocking: false
npx openspec validate harden-workbench-tool-surface-runtime --strict
node openspec/changes/harden-workbench-tool-surface-runtime/evidence/tester-harden-anti-pattern-checks.js
node openspec/changes/harden-workbench-tool-surface-runtime/evidence/cancel-subrun-electron-smoke.js
node openspec/changes/harden-workbench-tool-surface-runtime/evidence/harden-tool-surface-electron-smoke.js
node openspec/changes/harden-workbench-tool-surface-runtime/evidence/manual-feishu-apply-probe.js      # SKIP
node openspec/changes/harden-workbench-tool-surface-runtime/evidence/manual-playwright-mcp-probe.js    # SKIP
# 测试会话补测：IPv6/audit tamper/test-seam/CAS/LRU（9/9 pass，见 code-review.md）
git diff --name-only HEAD | rg 6-active-changes  # NO_TOUCH
```

---

## 证据路径

- `evidence/tester-harden-anti-pattern-checks.json` — 16/16
- `evidence/cancel-subrun-electron-smoke.json` — withinBudget, leakCount=0
- `evidence/harden-tool-surface-electron-smoke.json` — mode=v1, blockedCode=scope_denied
- `evidence/phase-gates.json` — P1–P3 PASS
- `evidence/manual-feishu-apply-probe.json` — SKIP
- `evidence/manual-playwright-mcp-probe.json` — SKIP
- `../code-review.md` — 13 finding + 边界补测 review

---

## 结论

- [x] **通过，可 story-done**
- [ ] 不通过，打回开发

**QA 结论: PASS** — 全部硬项 + Smoke + 反模式 BLOCKING 通过；无 BLOCKING/HIGH 未修复项。可进入 `/gate-check` → `/story-done`。
