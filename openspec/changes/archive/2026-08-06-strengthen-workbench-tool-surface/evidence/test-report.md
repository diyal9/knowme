# 测试报告: strengthen-workbench-tool-surface

- **测试角色**：Tester
- **日期**：2026-08-06
- **结论**：**PASS**（硬门禁 + Smoke 全通过；无 BLOCKING；真实凭据项已 SKIP）

## 门禁

| 检查项 | 级别 | 结果 | 命令/证据 |
|--------|------|------|-----------|
| preflight | 硬 | **PASS** | `node .cursor/scripts/harness.js preflight --json` |
| npm test | 硬 | **PASS** | 1069/1069 用例 |
| npm run lint | 硬 | **PASS** | `npm run lint` |
| harness gate | 硬 | **PASS** | `node .cursor/scripts/harness.js gate --json` |
| OpenSpec strict | 硬 | **PASS** | `openspec validate strengthen-workbench-tool-surface --strict` |
| qa-plan Smoke Scope | 软 | **已执行** | 见下表 |
| code-review | 软 | **已完成** | `code-review.md`（测试补充） |

## 执行命令汇总

```bash
node .cursor/scripts/harness.js preflight --json
npm test                                    # 1069 pass
npm run lint
node .cursor/scripts/harness.js gate --json
npx openspec validate strengthen-workbench-tool-surface --strict
node --test tests/tool-contract-registry.test.js tests/agent-file-tools.test.js \
  tests/agent-process-tools.test.js tests/agent-artifact-tools.test.js \
  tests/fake-feishu-write.test.js tests/mcp-http-transport.test.js \
  tests/browser-mcp-adapter.test.js tests/agent-orchestration.test.js \
  tests/tool-surface-closed-loop.test.js   # 65 pass
node scripts/agent-eval.js --suite tool-surface --baseline v1 \
  --out openspec/changes/strengthen-workbench-tool-surface/evidence/tool-surface-eval
node openspec/changes/strengthen-workbench-tool-surface/evidence/tool-surface-electron-smoke.js
node openspec/changes/strengthen-workbench-tool-surface/evidence/producer-electron-acceptance.js
node openspec/changes/strengthen-workbench-tool-surface/evidence/producer-acceptance-node.js
node openspec/changes/strengthen-workbench-tool-surface/evidence/tester-anti-pattern-checks.js
node openspec/changes/strengthen-workbench-tool-surface/evidence/tester-electron-ipc-roundtrip.js
```

## Smoke Scope 结果

| 用例 | 结果 | 证据 |
|------|------|------|
| 闭环 eval `tool-surface-closed-loop` 100% | **PASS** | `tests/tool-surface-closed-loop.test.js` + `evidence/tool-surface-eval.json` |
| Tool Contract 100% 覆盖 | **PASS** | `tool-contract-registry.test.js` + anti-pattern `contract/coverage-100` |
| 文件写 draft/拒绝/批准/备份 | **PASS** | `agent-file-tools.test.js` (13) + `producer-acceptance-node.json` |
| 进程 cancel ≤3s | **PASS** | `agent-process-tools.test.js` mock |
| 飞书 8 类 draft + 0 外部写 | **PASS** | `fake-feishu-write.test.js` (10) |
| Tool UX pending_review/badge | **PASS** | Electron smoke + `producer-electron-acceptance.json` |
| 活跃 change 隔离 | **PASS** | git diff 无 6 change 路径；preflight 确认 |
| 门禁 test+lint+gate | **PASS** | 见上 |

## 专项验证（独立重跑）

| 维度 | 用例数 | 结果 | 证据 |
|------|--------|------|------|
| Tool Contract/Registry/envelope/audit | 16 | PASS | `tool-contract-registry.test.js` |
| 文件 draft→approve→reject→traversal | 13+2 | PASS | `agent-file-tools.test.js` + anti-pattern |
| 进程 run/cancel/dangerous | 5 | PASS | `agent-process-tools.test.js` + sandbox screen |
| Artifact MD/CSV/PDF 边界 | 5 | PASS | `agent-artifact-tools.test.js` + anti-pattern |
| 飞书 8 类 draft/fakeApply/幂等 | 10 | PASS | `fake-feishu-write.test.js` |
| MCP HTTP/OAuth/schema cache | 5 | PASS | `mcp-http-transport.test.js` |
| Browser adapter/domain block | 6 | PASS | `browser-mcp-adapter.test.js` |
| Agent 编排 budget/cancel/handoff | 4 | PASS | `agent-orchestration.test.js` |
| Electron 审批卡/artifact/preload | 5+10 | PASS | smoke + producer-electron |
| Electron IPC approve/reject roundtrip | 7 | PASS | `tester-electron-ipc-roundtrip.json` |
| 反模式专项 | 24 | PASS | `tester-anti-pattern-checks.json` |

**测试用例合计（本 Story 相关）**：工具层专项 65 + 反模式 24 + IPC 7 + Electron/Node 验收 ≈ **110+**；全仓库回归 **1069**。

## 真实环境 SKIP（未伪造）

| 项 | 原因 | 负责 |
|---|---|---|
| 飞书真授权 apply（doc/IM/task/calendar/drive/wiki/bitable） | `FEISHU_CONFIG=NO`，无用户明确授权的真实写 | 用户凭据 manual |
| Playwright MCP browser_navigate+snapshot | `MCP_DIR=NO`，未配置 Playwright MCP | 用户 manual，见 `windows-smoke.md` C |
| live Agent 对话 apply_patch→批准→落盘 | 需 LLM + 内容源；fake eval 已覆盖逻辑 | 可选 UAT |
| Hub Playwright 安装指引点击流 | 未在 Capability Hub UI 逐字走查 | ADVISORY |
| 子 Agent live delegate 取消传播 | 单测覆盖；Electron 未跑 live Run | ADVISORY |
| 文件写 UI live 触发（windows-smoke A） | 需 Agent 对话触发；mock/IPC 已覆盖 | 部分 SKIP |

## 反模式发现

### [ADVISORY] 审批卡 summary 缺少 path/connector 摘要
- **反模式**：不展开 diff 时无法一眼看到目标路径
- **预期**：summary 行显示 `preview.txt` 或 connector 名
- **实际**：仅「待确认」badge + 通用 hint；path 在 `<pre>` diff 内
- **证据**：`workspace-agent.js` `renderToolApprovalCard`；制作人 advisory #1 复测确认
- **建议**：后续 Story 在 summary/title 增加 `item.targetPath` 或 `draft.kind`

### [ADVISORY] 回滚 UI 入口缺失
- **反模式**：用户批准写错文件后找不到「回滚」按钮
- **预期**：审批卡或 artifact 链上有回滚入口
- **实际**：`preload.toolRollbackDraft` + main IPC 已实现；`workspace-agent.js` 无 UI 绑定
- **证据**：anti-pattern `ux/rollback-ui-missing`；`file-backup.js` 单测通过
- **建议**：P2+ UX Story 增加「回滚到备份」按钮

### [ADVISORY] mkdir 低风险直建用户认知
- **反模式**：用户不理解 mkdir 为何不需审批
- **预期**：Hub/时间线标注「低风险直建目录」
- **实际**：符合 spec；无额外文案
- **证据**：`agent-file-tools.test.js` mkdir 直执行用例

### [ADVISORY] Hub MCP health/Playwright 安装指引未点击验证
- **反模式**：Capability Hub 文案可能误导
- **预期**：health 红灯 + 安装步骤可点通
- **实际**：`capability-hub-service.js` / `mcp-http-transport` 单测通过；UI 未走查
- **证据**：acceptance 子路径未勾选

## BLOCKING

**无。**

## 结论

- [x] **通过，可进入 `/gate-check` → `/story-done`**
- [ ] 不通过，打回开发

## 证据目录

| 文件 | 说明 |
|------|------|
| `evidence/test-report.md` | 本报告 |
| `evidence/tester-anti-pattern-checks.json` | 24 项反模式 |
| `evidence/tester-electron-ipc-roundtrip.json` | IPC roundtrip |
| `evidence/tool-surface-eval.json` | eval 7/7 pass |
| `evidence/phase-gates.json` | P1–P4 |
| `evidence/producer-electron-acceptance.json` | Electron UI |
| `evidence/producer-acceptance-node.json` | Node 契约 |
| `evidence/screenshots/` | producer + tester 截图 |

**验收人**：Tester Agent  
**日期**：2026-08-06
