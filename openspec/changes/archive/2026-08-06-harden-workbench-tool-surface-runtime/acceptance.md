# 制作人体验验收: harden-workbench-tool-surface-runtime

> 前置：开发 Phase 1–3 完成且 `evidence/dev-self-test.md` 无 BLOCKING。  
> 制作人独立复跑见 `evidence/producer-uat.md`（2026-08-06）。

## 核心路径

### 安全与取消（HIGH）

- [x] 发起 Agent Run（v1），确认工具经 Registry（时间线/日志可见 auditId）  
  证据：`tests/harden-tool-surface.test.js` registry execute envelope + auditId；`harden-tool-surface-electron-smoke.json` mode=v1, toolCount=11
- [x] 触发子 Agent delegate 后立即「取消 Run」：≤3s 子步骤显示 cancelled，无持续输出  
  证据：`cancel-subrun-electron-smoke.json` withinBudget=true, leakCount=0；AP4 elapsed=0ms（mock orchestration）
- [x] 尝试让 Agent 执行可疑 shell（若 UI 可触发）：应被拒绝并有中文说明  
  证据：AP5/AP6 — PowerShell/cmd 注入、node -e 中文拒绝

### 浏览器与审批（MEDIUM）

- [x] Agent 或工具尝试访问 `http://localhost`：硬拦截，**不**出现「首次确认」误导  
  证据：`harden-tool-surface-electron-smoke.json` blockedCode=scope_denied；单测 assert 非 approval_required
- [x] 公网新域名：首次确认 flow 可完成且后续同 Run 可继续  
  证据：`tests/harden-tool-surface.test.js` 公网 requireHostConfirm 分支（单测覆盖逻辑）
- [x] 快速连点「批准」：仅一次生效，按钮 pending 时 disabled+loading  
  证据：AP1 second=not_pending；`workspace-agent.js` is-loading + early return
- [x] 双窗口同时批准同一 draft：第二次提示已处理，无重复写  
  证据：AP2 not_pending；UI 反馈 `已处理`（code not_pending）

### 文件与 mkdir（M4/M5）

- [x] move_path 批准后若模拟失败（dev 工具）：文件可回滚（或单测证据已附）  
  证据：AP9 rollbackMove 恢复 src/a.txt；UI「回滚到备份」入口
- [x] 内容源内 mkdir：目录立即创建，时间线显示路径 +「低风险直建」  
  证据：AP10 `已创建目录 \`parent/child\` · 低风险直建`
- [x] 内容源外 mkdir：出现审批卡  
  证据：`tests/harden-tool-surface.test.js` M5 外路径 draft 分支

### UX 补全（LOW）

- [x] 文件 write/move/飞书 draft 审批卡 summary 一眼可见目标（非仅「待确认」）  
  证据：`draftApprovalSummary` path / from→to / 飞书标题；ADVISORY：飞书 connector 类型未单独展示（见 producer-uat UX-A1）
- [x] 已 apply 的文件写操作可见「回滚到备份」入口且可用  
  证据：`renderToolApprovalCard` rollbackBtn + IPC `toolRollbackDraft`
- [x] Capability Hub Playwright 安装指引链接可点击打开  
  证据：AP13 `data-hub-open-url` + `@playwright/mcp` npm 链接

### Legacy 回退

- [x] `KNOWME_TOOL_SURFACE=legacy`：无 v1 写/编排工具暴露（抽样验证）  
  证据：AP15 filtered write_file

## 体验标准

- [x] 取消/拒绝/拦截后用户感知明确，无「假成功」
- [x] 审批 pending 不可重复提交
- [x] blocked 域名不出现「批准访问」类误导按钮
- [x] mkdir 直建与 draft 场景用户能区分原因
- [x] 响应：取消反馈 ≤3s 可感知（mock 0ms；逻辑 withinBudget）

## 隔离确认

- [x] 本 Story 未修改 6 活跃 change 专属文件（对照 proposal Impact 清单）  
  证据：git diff 未命中 6 change 路径

## 真实环境 SKIP（未伪造 PASS）

| 项 | 证据 |
|---|---|
| 飞书真 apply | `manual-feishu-apply-probe.json` skipped |
| Playwright MCP live | `manual-playwright-mcp-probe.json` skipped |

## 验收结论

- [x] **通过** / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-06
- 证据：`evidence/producer-uat.md`、`tester-harden-anti-pattern-checks.json`、`cancel-subrun-electron-smoke.json`、`harden-tool-surface-electron-smoke.json`
