# Code Review: harden-workbench-tool-surface-runtime

- **Reviewer**: 测试（Tester）
- **Date**: 2026-08-06
- **Scope**: 13 项 review finding 修复核实 + 新增安全边界补测
- **Method**: 独立源码走读 + 测试会话重跑（非复述 dev/producer 报告）

## 结论

**PASS** — 13 项原 finding 均已真实修复；无 BLOCKING/HIGH 未修复项。4 项 ADVISORY 已记录，不阻断 story-done。

---

## 13 项 Finding 核实

| ID | 级别 | Finding | 修复状态 | 验证方式 |
|----|------|---------|----------|----------|
| H1 | HIGH | Registry 未接入 Agent 生产热路径 | **FIXED** | `main.js` ai-generate 在 `needsConnectorTools` 时调用 `resolveToolSurfaceForRun`；v1 经 Registry 投影 + envelope/audit；legacy 分支 `filterLegacyExtraTools` 剔除写/编排工具；单测 H1×3 |
| H2 | HIGH | cancelSubRun 未接线，子 Run 泄漏 | **FIXED** | `ai-cancel-run` → `controller.abort()` + `cancelProcessesForRun` + `orch.cancelAll({ cancelSubRun })` 真实调用 `sub.abort()` 并 `activeSubRuns.delete`；二次 sweep 按 `parentRunId`；AP4 + cancel-subrun-electron-smoke |
| H3 | HIGH | start_process shell 绕过 | **FIXED** | `shell:false` 默认；模板 registry + `screenCommand`/DANGEROUS_PATTERNS；PowerShell/cmd/node -e 100% 拒绝；AP5/AP6 + H3×5 单测 |
| M1 | MED | blockedHosts 误返回 approval | **FIXED** | `isDomainAllowed` 先 blocked/RFC1918/IPv6 ULA → `scope_denied`；handler 127.0.0.1 非 `approval_required`；`::1`/`[::1]` 在 DEFAULT_BLOCKED_HOSTS；补测 browser-ipv6-loopback |
| M2 | MED | 渲染 IPC 可注入 fakeApply | **FIXED** | `resolveTestSeamOpts` → `stripTestKeysFromPayload` 剥离 test 键；`isTestSeamEnabled()` 仅 `KNOWME_TEST_SEAM=1` / NODE_ENV=test / npm test；生产模拟 seam 为空；AP M2/strip-fakeApply |
| M3 | MED | Draft 并发竞态 | **FIXED** | `casBeginApply` pending→applying CAS；第二次 `not_pending`；`renameWithRetry` EPERM 50/100/200ms；`finishApply` failed 状态；AP1/AP2 |
| M4 | MED | move 回滚不完整 | **FIXED** | `file-backup.rollbackMove` source/target 双向恢复；AP9 恢复 src/a.txt |
| M5 | MED | mkdir 认知模糊 | **FIXED** | 内容源内直建 0 draft + 时间线「低风险直建」；外路径走 draft；AP10 + M5 单测 |
| M6 | MED | store 无 eviction | **FIXED** | `runtime-store.createEvictingMap` TTL+LRU；terminal 按 endedAt 过期；running 24h 内不 TTL 驱逐；AP11/AP12 + M6×4 |
| L1 | LOW | 审计链不完整 | **FIXED** | `appendAuditLog` prevHash/recordHash SHA-256；`getLastAuditWriteError` 写失败可见；`redactSensitiveFields` 脱敏；补测 tamper hash mismatch |
| L2 | LOW | symlink/junction TOCTOU | **FIXED** | `path-security.js` lstat/realpath/父路径 walk；junction 中文拦截文案；L2×4 单测 |
| L3 | LOW | 批准 IPC 重复实现 | **FIXED** | `approveToolDraft` 单实现；`approveFeishuDraft`/`connectors-approve-draft` 薄代理 + deprecated 日志 |
| L4 | LOW | Tool UX 缺失 | **FIXED** | `draftApprovalSummary` path/move/飞书标题；pending `disabled`+`is-loading`；rollback 按钮 + IPC；Hub `data-hub-open-url` AP13 |

---

## 新增安全边界补测

| 边界 | 结果 | 说明 |
|------|------|------|
| URL 重定向 SSRF | **PASS** | `tests/web-fetch.test.js` redirect-private → blocked；npm test 1107 全绿 |
| IPv6 localhost | **PASS** | `browser-mcp-adapter` `::1`/`[::1]` blocked；补测 `http://[::1]/admin` → scope_denied |
| 审计链篡改检测 | **PASS**（离线） | 篡改 outcome 后 recordHash 不匹配；prevHash 链式链接正确；**无运行时 verify API**（见 ADVISORY） |
| Active process eviction | **PASS**（TTL） | running 进程 5s TTL 窗口内不被驱逐；**LRU 超 cap 可驱逐最旧 running**（见 ADVISORY） |
| Test seam 生产污染 | **PASS** | 清除 test env 后 `isTestSeamEnabled()===false`；fakeApply stripped 且 seam 空 |
| CAS apply 失败重试 | **PASS** | `casBeginApply` → `finishApply(failed:true)` → status=failed；EPERM renameWithRetry 有退避 |

---

## ADVISORY Findings（不阻断）

### CR-A1: LRU cap 可能驱逐最旧 running 进程

- **位置**: `src/lib/runtime-store.js` purge() while (map.size > maxEntries) 按 Map 迭代序删首项，不区分 status
- **风险**: 极端并发（>500 进程条目）下最旧 running 可能被 evict，task_status 返回 not_found
- **缓解**: processStore maxEntries=500；正常运行远低于阈值
- **建议**: 后续可考虑 LRU 跳过 `running`/`starting` 状态

### CR-A2: 审计链无运行时 verify 函数

- **位置**: `tool-contract-registry.js` 仅 append + readLastAuditHash
- **风险**: 篡改需离线工具检测；符合 spec「tamper-evident only，非不可抵赖」
- **建议**: 可选增加 `verifyAuditChain(userData)` 供管理员工具

### CR-A3: Electron smoke 为逻辑 mock 非真机壳

- **位置**: `evidence/cancel-subrun-electron-smoke.js`、`harden-tool-surface-electron-smoke.js`
- **说明**: 直接 require 主进程模块验证 orchestration/resolver/browser adapter，非 Playwright 驱动 Electron UI
- **影响**: 取消/拦截/Registry 行为已覆盖；live Agent UI 审批仍 optional SKIP

### CR-A4: 飞书 draft 审批卡未显式展示 connector 类型

- **位置**: `workspace-agent.js` draftApprovalSummary
- **说明**: 制作人 UX-A1 已记录；有标题/「飞书写入」但无 connector id 标签

### CR-A5: chat-only 路径 bypass resolver

- **位置**: `main.js` `needsConnectorTools=false` → `{ surface: createToolSurface(), mode: 'minimal' }`
- **说明**: tier=chat 无工具时合理；有工具时必走 resolver

---

## 活跃 Change 隔离

`git diff --name-only HEAD` 未命中 6 个并行 change 专属路径 → **确认零 touch**。

## Reviewer 签名

- 测试 QA 独立 review 完成
- 可进入 `/gate-check` → `/story-done`
