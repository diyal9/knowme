# 制作人体验验收报告

- Change：`harden-workbench-tool-surface-runtime`
- 验收人：制作人（Agent）
- 日期：2026-08-06
- Preflight：`node .cursor/scripts/harness.js preflight --json` → **PASS**（2026-08-06 独立复跑）

## 独立复跑（非复述 dev-self-test）

| 命令 / 脚本 | 结果 | 证据 |
|---|---|---|
| `npm test` | **PASS** 1107/1107 | 制作人会话独立复跑 |
| `node .cursor/scripts/harness.js gate --json` | **PASS** blocking: false | 同上 |
| `node evidence/tester-harden-anti-pattern-checks.js` | **PASS** 16/16 | `tester-harden-anti-pattern-checks.json` |
| `node evidence/cancel-subrun-electron-smoke.js` | **PASS** elapsedMs=0, leakCount=0 | `cancel-subrun-electron-smoke.json` |
| `node evidence/harden-tool-surface-electron-smoke.js` | **PASS** blockedCode=scope_denied | `harden-tool-surface-electron-smoke.json` |
| `node evidence/manual-feishu-apply-probe.js` | **SKIP** | `manual-feishu-apply-probe.json` |
| `node evidence/manual-playwright-mcp-probe.js` | **SKIP** | `manual-playwright-mcp-probe.json` |

> 说明：change 内「Electron smoke」脚本为 **主进程逻辑 mock**（orchestration/resolver/browser adapter），非 Playwright 真机壳；取消/拦截/Registry 行为已由上述脚本 + 1107 单测覆盖。

## 10 项真机/体验重点核对

| # | 要点 | 结论 | 验证方式 |
|---|---|---|---|
| 1 | 审批卡 summary + pending disabled/loading + 连点防双写 | **PASS** | `workspace-agent.js` 源码：`draftApprovalSummary` 展示 path/move/飞书标题；点击后 `disabled`+`is-loading`；AP1/AP2 CAS `not_pending` |
| 2 | rollback 可发现、反馈清楚、move 双向恢复 | **PASS** | UI 有「回滚到备份」按钮+成功/失败文案；AP9 `rollbackMove` 恢复 source/target |
| 3 | mkdir 直建显示「低风险直建」+ 路径 | **PASS** | AP10 + `agent-file-tools` 时间线文案 `已创建目录 \`rel\` · 低风险直建` |
| 4 | Run 取消 ≤3s 收敛、无泄漏 | **PASS**（mock） | AP4 + `cancel-subrun-electron-smoke.json` withinBudget=true, leakCount=0 |
| 5 | start_process 安全模板 / 注入拒绝 | **PASS** | AP5 PowerShell、AP6 node -e 中文拒绝文案 |
| 6 | localhost/内网硬拒绝、非公网误导 | **PASS** | AP7 + `harden-tool-surface.test.js` blocked 非 `approval_required` |
| 7 | fakeApply/test seam 生产 IPC 不可达 | **PASS** | M2 strip + `test-seam.js` 仅 `KNOWME_TEST_SEAM` |
| 8 | eviction/旧 id/脱敏/symlink 反馈 | **PASS** | AP8/AP11/AP12 + `path-security.js` junction 中文拦截 |
| 9 | Hub Playwright 安装指引可点击 | **PASS**（静态） | `capability-hub.js` `data-hub-open-url` + AP13；未安装时 health 红灯文案，不报成功 |
| 10 | legacy flag 回退 | **PASS** | AP15 过滤 write/orchestration 投影 |

## ADVISORY（不阻断 PASS）

| ID | 说明 | 期望 |
|---|---|---|
| UX-A1 | 飞书 draft 审批卡 summary 未显式展示 connector 类型（仅有标题/「飞书写入」） | 正式 QA 有凭据时可补验；可选 UI 增强 |
| UX-A2 | 无 live Agent Run 审批卡/取消 Run 真机截图 | 交测试 optional UAT（需 LLM 凭据） |
| UX-A3 | change 内 Electron smoke 命名易误解为 Playwright 壳 | 文档已注明 mock 层级 |

## 真实环境 SKIP

| 项 | 条件 | 状态 |
|---|---|---|
| 飞书真 apply | 无 `FEISHU_CONFIG` | **SKIP**（未伪造 PASS） |
| Playwright MCP navigate | 无 `MCP_DIR` | **SKIP**（未伪造 PASS） |

## 活跃 change 隔离

`git diff --name-only HEAD` 未命中 6 个并行 change 专属路径 → **确认隔离**。

## 验收结论

**PASS** — 无 BLOCKING；可交正式 QA（测试按 `qa-plan.md` 执行反模式 + optional 凭据 UAT）。
