# 制作人体验验收: strengthen-workbench-tool-surface

## 核心路径（闭环）

- [x] **理解→查找**：`read_file`/`grep_files` 单测 + 闭环 eval 读步骤通过；时间线 truncated/来源由 `agent-thinking-timeline` 单测与 eval 覆盖（Electron 未跑 live grep UI）。
- [x] **修改（审批）**：制作人 node 验收：`write_file` → draft → 拒绝后 hash 不变；`apply_patch` diff preview 单测通过；Electron mock 审批卡含 diff + 待确认 badge（`evidence/screenshots/producer-v1-approval-timeline.png`）。
- [x] **执行→验证**：`run_task`/`cancel_task` 单测通过（cancel ≤3s mock）；闭环 eval 含 npm test 步骤。
- [x] **交付**：`agent-artifact-tools` 单测 Markdown/CSV/PDF 边界；Electron mock artifact 卡可见；无 docx 入口（反模式清单）。
- [x] **外部写（飞书）**：`fake-feishu-write` 8 类 draft 全部 pending、0 外部写；approve spy 路径通过。**真实飞书 apply 未执行**。
- [x] **缺失能力**：`browser-mcp-adapter` 未配置返回 `Playwright MCP 未配置`；`agent-tool-failure-hint` 覆盖 approval/scope 可读提示（单测/代码审阅）。

## 体验标准

- [x] 审批卡 3 秒内可理解动作与「需批准」（Electron 截图 + mock 卡文案）
- [x] pending 步骤标签为「查看预览」/ `pending-review`，非「已成功写入」（代码 + Electron DOM）
- [x] 无 Feishu/Playwright 时 fake 路径不崩溃；产品可启动且无业务 console error（Electron 验收）
- [x] 与 6 活跃 change 无文件 touch（`code-review.md` + preflight active_changes 隔离）

## 子路径抽检

- [x] **Hub MCP health/preview**：`capability-hub.js` + `mcp-http-transport` 单测；**Hub UI 点击流未验**
- [ ] **浏览器 navigate+snapshot（manual 凭据）**：**未执行** — 无 Playwright MCP 配置
- [x] **子 Agent**：`agent-orchestration.test.js` delegate/cancel/handoff；**Electron live delegate 未验**
- [x] **legacy 回退**：`KNOWME_TOOL_SURFACE=legacy` 无 write/run_task 投影；Electron legacy 场景启动通过

## 验收结论

- [x] **通过** / [ ] 不通过
- **验收人**：制作人
- **日期**：2026-08-06
- **证据**：
  - `evidence/producer-acceptance.md`
  - `evidence/producer-acceptance-node.json`
  - `evidence/producer-electron-acceptance.json`
  - `evidence/tool-surface-eval.json`
  - `evidence/phase-gates.json`
  - `evidence/screenshots/producer-v1-approval-timeline.png`
  - `evidence/screenshots/producer-v1-workbench.png`
- **备注**：核心路径 fake/单测/Electron 子集 PASS；飞书真 apply、Playwright MCP、live Agent 对话交给测试 manual。
