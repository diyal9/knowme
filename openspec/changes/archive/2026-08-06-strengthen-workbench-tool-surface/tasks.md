## 1. Phase 0 — 规划与基线（本 Story 规划阶段）

- [x] 1.1 确认 preflight 通过且 6 活跃 change 路径不在本 change 修改范围
- [x] 1.2 OpenSpec 工件齐全：proposal / design / specs / tasks / qa-plan / acceptance
- [x] 1.3 `openspec validate --change strengthen-workbench-tool-surface --strict` 通过

## 2. Phase 1 — Tool Contract Registry + 文件写（硬门禁 P1）

- [x] 2.1 新增 `src/lib/tool-contract-registry.js`：register、validate、envelope、auditId
- [x] 2.2 重构 `agent-tools.js`：`createToolSurface` 从 Registry 投影；内置工具注册契约
- [x] 2.3 扩展 `agent-file-tools.js`：write/create/apply_patch/move/copy/delete/mkdir + path policy
- [x] 2.4 通用 draft store v2：`tool-drafts.json` 迁移 + approve/reject IPC（main/preload）
- [x] 2.5 写前备份 `.knowme/backups/<runId>/` 与 rollback handler
- [x] 2.6 单测：`tests/tool-contract-registry.test.js`（≥15）、扩展 `agent-file-tools.test.js`（≥10）
- [x] 2.7 P1 gate：`evidence/phase-gates.json` 记录 closed-loop 子集（读+patch draft）eval 100%

## 3. Phase 2 — 进程/产物/飞书写/Tool UX（硬门禁 P2）

- [x] 3.1 新增 `src/lib/agent-process-tools.js`：run_task/start_process/status/logs/cancel
- [x] 3.2 进程 registry 与 Run cancel 联动（main.js）
- [x] 3.3 新增 `src/lib/agent-artifact-tools.js`：markdown/text/csv/pdf（≤20 页边界）
- [x] 3.4 扩展 `feishu-cli.js` + draft defs：doc/IM/task/calendar/drive/wiki/bitable draft 工具
- [x] 3.5 `tool-runtime.js` 注册全部新工具 + idempotencyKey + apply 重试边界
- [x] 3.6 UI：`workspace.js` 审批卡、draft inbox、缺失能力提示、artifact 卡片
- [x] 3.7 扩展 `agent-tool-failure-hint.js` 新 error code
- [x] 3.8 单测+fake：`tests/fake-feishu-write.test.js`、`agent-process-tools.test.js`、`agent-artifact-tools.test.js`
- [x] 3.9 P2 gate：fake Feishu draft ≥8 通过；run_task cancel ≤3s（mock）

## 4. Phase 3 — MCP 增强 + 浏览器自动化（硬门禁 P3）

- [x] 4.1 `mcp-host.js`：transport 抽象 stdio | streamable-http
- [x] 4.2 OAuth token 存储 + refresh 钩子 `%APPDATA%/KnowMe/mcp-oauth/`
- [x] 4.3 schema 缓存 `%APPDATA%/KnowMe/mcp-schemas/` + health check
- [x] 4.4 新增 `src/lib/browser-mcp-adapter.js`：Playwright MCP 投影 + 域名 allowlist
- [x] 4.5 Hub：MCP health、risk 确认、Playwright 安装指引（capability-hub UI）
- [x] 4.6 单测：`tests/mcp-http-transport.test.js`、`browser-mcp-adapter.test.js`（fake MCP）
- [x] 4.7 P3 gate：domain block + HTTP list/call fake 集成通过

## 5. Phase 4 — Agent 编排 + 全量 Eval + Smoke（硬门禁 P4）

- [x] 5.1 新增 `src/lib/agent-orchestration.js`：delegate_to_expert、parallel cap、handoff
- [x] 5.2 `agent-run-executor.js`：ORCHESTRATE 阶段、子 Run cancel 传播、approval gate
- [x] 5.3 `expert-runtime.js`：orchestration frontmatter 解析与校验
- [x] 5.4 `workbench-daemon-client` 可选 handoff artifact 同步（只读对齐，不改 daemon 加载 change）
- [x] 5.5 Eval fixture：`tests/fixtures/agent-eval/tool-surface-closed-loop.json` + harness 套件
- [x] 5.6 Electron smoke：`evidence/tool-surface-electron-smoke.js`（审批卡+时间线）
- [x] 5.7 Feature flag：`KNOWME_TOOL_SURFACE=v1|legacy` 默认 v1，文档化回滚
- [x] 5.8 P4 gate：full closed-loop eval 100%；`npm test` + lint + harness gate
- [x] 5.9 文档化 Windows manual smoke（Playwright+Feishu 凭据）→ `evidence/windows-smoke.md`

## 6. 交付与门禁

- [x] 6.1 开发自测：`evidence/dev-self-test.md`
- [x] 6.2 制作人验收：`acceptance.md` 勾选
- [x] 6.3 测试 QA：`evidence/test-report.md` + 反模式清单
- [x] 6.4 `code-review.md` 确认未 touch 6 活跃 change 文件
- [x] 6.5 `/story-done` 前 harness gate 通过
