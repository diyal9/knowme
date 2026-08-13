## 1. Phase 0 — 规划与隔离（本阶段）

- [x] 1.1 确认 preflight 通过；6 活跃 change 路径不在本 change 修改范围
- [x] 1.2 OpenSpec 工件齐全：proposal / design / specs / tasks / qa-plan / acceptance
- [x] 1.3 `openspec validate harden-workbench-tool-surface-runtime --strict` 通过

## 2. Phase 1 — HIGH：Registry 热路径 + Run 取消 + start_process（硬门禁 P1）

### H1 — Tool Contract Registry 生产热路径

- [x] 2.1 实现 `resolveToolSurfaceForRun(runCtx)` 于 `tool-surface-builder.js`：v1→Registry 投影 + execute wrapper（validate/envelope/audit）
- [x] 2.2 `agent-run-executor.js` 与 `main.js` ai-generate 路径改调 resolver；移除生产路径 ad-hoc `createToolSurface`
- [x] 2.3 `tool-runtime.js` 对齐 resolver；legacy 分支单测
- [x] 2.4 单测：v1 100% Registry 投影；legacy 无 write/orchestration；envelope/auditId 断言（≥8 用例）

### H2 — ai-cancel-run 子 Run 取消

- [x] 2.5 `main.js` `ai-cancel-run` 传入 `cancelSubRun` 至 orchestration；abort 子 Run AbortController
- [x] 2.6 `agent-orchestration.js`：`cancelAllSubRuns` 预算停止；running 泄漏检测
- [x] 2.7 单测：父 cancel ≤3s 子 Run CANCELLED（≥4 用例）
- [x] 2.8 Electron E2E：`evidence/cancel-subrun-electron-smoke.js` mock delegate→cancel→无泄漏

### H3 — start_process 加固

- [x] 2.9 `start_process` 限制为 template registry 或 sandbox 共用 `screenCommand`/DANGEROUS_PATTERNS/network gate
- [x] 2.10 Windows：`shell:false` 默认；argv 数组化；PowerShell/node 注入负例单测（≥5）
- [x] 2.11 P1 gate：`evidence/phase-gates.json` 记录 H1–H3 通过

## 3. Phase 2 — MEDIUM：浏览器/IPC/Draft/move/mkdir/eviction（硬门禁 P2）

### M1 — blockedHosts 硬拒绝

- [x] 3.1 `browser-mcp-adapter.js`：blocked/private IP 检查先于 approval；localhost/内网 100% `scope_denied`
- [x] 3.2 单测：blocked 不返回 `approval_required`；公网首次确认可完成（≥6）

### M2 — 生产 IPC test seam

- [x] 3.3 主进程 strip 渲染 IPC 的 `fakeApply`/测试键；`KNOWME_TEST_SEAM=1` test-only 注入
- [x] 3.4 audit 扩展 approverId/sessionId/runId；OAuth token 日志脱敏单测

### M3 — Draft CAS

- [x] 3.5 `tool-drafts-store.js`：pending→applying→applied 状态机 + CAS
- [x] 3.6 Windows EPERM rename 退避重试；双窗口/快速连点反模式单测（≥4）

### M4 — move_path 回滚

- [x] 3.7 `file-backup.js` / apply handler：source+target 双向 rollback
- [x] 3.8 单测：move 失败中间态恢复（≥3）

### M5 — mkdir 产品决策

- [x] 3.9 实现直建 vs draft 分支（design D8）；时间线「低风险直建」文案
- [x] 3.10 单测：内容源内直建 0 draft + title 含路径（≥2）

### M6 — Store eviction

- [x] 3.11 processRegistry/artifactStore/runStates TTL+LRU；重启旧 id 友好返回
- [x] 3.12 单测：expired/not_found 文案（≥4）
- [x] 3.13 P2 gate：`evidence/phase-gates.json` 记录 M1–M6

## 4. Phase 3 — LOW + UX：审计/路径/IPC/UX/Hub（硬门禁 P3）

### L1 — 审计 hash chain

- [x] 4.1 audit append：prevHash/recordHash；写失败可见；敏感字段脱敏（≥5 单测）

### L2 — symlink/junction

- [x] 4.2 `agent-file-tools.js` + `content-sources`：lstat/realpath；Windows junction 负例（≥4）

### L3 — 批准 IPC 合并

- [x] 4.3 统一 `toolApproveDraft`；legacy IPC 薄代理 + deprecated 日志

### L4 — Tool UX

- [x] 4.4 `toolTimelineTitle` 可读摘要（write/move/飞书/mkdir）
- [x] 4.5 审批卡 summary + pending loading + rollback UI 入口（`workspace-agent.js`）
- [x] 4.6 Hub Playwright 安装指引可点击；health 红灯一致
- [x] 4.7 Electron smoke：`evidence/harden-tool-surface-electron-smoke.js`

## 5. 测试与反模式专项

- [x] 5.1 新增 `tests/harden-tool-surface.test.js` 聚合加固用例（目标 ≥35）
- [x] 5.2 `evidence/tester-harden-anti-pattern-checks.js`：连点竞态、拒绝无副作用、cancel 泄漏、注入、内网拦截、脱敏、move 回滚、mkdir、store 上限、legacy 回退、Hub 点击流、live IPC（≥20 项）
- [x] 5.3 可选凭据脚本：`evidence/manual-feishu-apply-probe.js`、`evidence/manual-playwright-mcp-probe.js`（SKIP 检测 FEISHU_CONFIG/MCP_DIR）
- [x] 5.4 回归：`npm test` + `npm run lint` + harness gate 全绿

## 6. 交付与门禁（开发 → 制作人 → 测试 → story-done）

- [x] 6.1 开发自测：`evidence/dev-self-test.md`
- [x] 6.2 制作人体验验收：`acceptance.md` 勾选（2026-08-06 PASS，见 `evidence/producer-uat.md`）
- [x] 6.3 测试 QA：`evidence/test-report.md` + `code-review.md`（2026-08-06 PASS）
- [x] 6.4 确认 git diff **0** touch 6 活跃 change 专属路径
- [x] 6.5 `/gate-check` → `/story-done` 前 harness gate 通过
