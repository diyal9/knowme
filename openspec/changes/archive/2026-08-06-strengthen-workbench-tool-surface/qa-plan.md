# QA Plan: strengthen-workbench-tool-surface

## Smoke Scope（必填）

- [x] **闭环 eval（fake，hard）**：场景 `tool-surface-closed-loop` — 读文件 → apply_patch → run_task(npm test) → create_artifact → feishu.draft_send_message（不 approve）→ eval 通过率 100%；spy 断言 0 次真实外部写。
- [x] **Tool Contract 覆盖**：Registry 投影工具 100% 具契约字段；缺字段工具不得进入 Agent 表（单测断言）。
- [x] **文件写审批**：write/apply_patch/delete 产生 draft；未批准时磁盘 hash 不变；批准后变更可回滚。
- [ ] **进程取消**：run_task 或 start_process 运行中取消 Run → ≤3s terminal=cancelled，无僵尸进程（Windows 单测 mock + 1 真机抽查）。
- [x] **飞书写 draft**：至少 3 类 draft（doc / IM / task）创建 pending；approve/reject 路径正确；idempotencyKey 防重复 apply（fake Feishu）。
- [x] **Tool UX**：时间线展示 pending_review、truncated、失败恢复提示；待审批 badge 可见。
- [x] **活跃 change 隔离**：`npm test` 全绿且 6 个活跃 change 相关测试无失败；git diff 不 touch 其专属路径（code review 清单）。
- [x] **门禁**：`npm test` + `npm run lint` + `node .cursor/scripts/harness.js gate --json` 通过。

## Regression Scope

- 现有 `agent-file-tools` 只读、`agent-sandbox`、`fetch_web_page`、Feishu read、`feishu.draft_write_doc` 行为不退化。
- `agent-run-executor` phases/metrics 与 `agent-eval` fixtures 不退化。
- `agent-thinking-timeline` 流式增量 DOM（展开/折叠/计时 tick）不退化。
- MCP stdio 连接器并行投影与 allowlist 不退化。
- `KNOWME_TOOL_SURFACE=legacy` 回滚路径可用。
- Expert Session 快照与 unbound skill 排除逻辑不退化。

## Anti-pattern Checks（交给测试）

- 未批准 draft 却显示「已发送/已写入飞书/已保存文件」。
- 工具数量堆叠但闭环 eval 失败（只数工具不算交付）。
- 路径 traversal 写入内容源外或 `%APPDATA%` 任意目录。
- run_task 绕过 sandbox 执行 curl/rm -rf。
- Playwright 未配置却声称 browser_snapshot 成功。
- PDF/docx 虚假支持（UI 或工具描述承诺未实现格式）。
- 子 Agent 无限递归或并行失控导致 API/工具预算爆炸。
- fake 测试伪造 Feishu/MCP 成功而标记 manual 用例为 CI 通过。
- 6 个活跃 change 文件被本 Story 误改（brand icon、launch dialog、link preview 等）。

## 测试分层与凭据策略

| 层级 | 范围 | 凭据 | CI |
|---|---|---|---|
| 单元/契约 | Registry、file/process/artifact/orchestration 纯逻辑 | 无 | **硬门禁** |
| 集成 fake | fake MCP server、fake Feishu CLI spy | 无 | **硬门禁** |
| 安全负例 | traversal、dangerous shell、未批准写 | 无 | **硬门禁** |
| Agent eval | `tool-surface-closed-loop` + 工具选择 eval | 无（mock LLM） | **硬门禁** |
| Electron E2E | 审批卡、时间线、draft inbox | 无（fixture 源） | 软 → 目标 hard |
| Windows Smoke | 真 Playwright MCP、真 Feishu 授权 | **用户环境** | **manual**，不得伪造 |
| 性能 eval | 工具选择准确率、P95 工具延迟 | 无/mock | 软，报告入 evidence |

**禁止**：无 Feishu token 时 stub 为 green；无 Playwright MCP 时 skip 却标 smoke 通过。

## Eval 与证据路径

| 产物 | 路径 |
|---|---|
| 开发自测 | `evidence/dev-self-test.md` |
| Phase gate | `evidence/phase-gates.json` |
| 闭环 eval | `evidence/tool-surface-eval.json` |
| 测试报告 | `evidence/test-report.md` |
| Code review | `code-review.md` |
| Windows manual smoke | `evidence/windows-smoke.md` |
| 截图 | `evidence/screenshots/` |

回归命令（实现后）：

```bash
npm test
npm run lint
node scripts/agent-eval.js --suite tool-surface --baseline v1 --out openspec/changes/strengthen-workbench-tool-surface/evidence/tool-surface-eval
node .cursor/scripts/harness.js gate --json
```

## Phase 硬门禁（与 tasks 对齐）

| Phase | 硬门禁 |
|---|---|
| P1 Registry+File | 契约单测 ≥15；file draft 单测 ≥10；闭环 eval 子集（读+patch draft）100% |
| P2 Process+Artifact+Feishu+UX | run_task cancel 单测；fake Feishu draft ≥8；审批 UI smoke |
| P3 MCP+Browser | fake MCP HTTP；domain block 单测；browser 工具投影单测 |
| P4 Orchestration+E2E | delegate depth/parallel 单测；full closed-loop eval 100%；Windows manual 文档化 |

## 维度阈值（tool-surface eval v1 草案）

| 维度 | Hard | 最低分 |
|---|---|---|
| closedLoopPass | 是 | 1.0 |
| externalWriteBlocked | 是 | 1.0 |
| contractCoverage | 是 | 1.0 |
| approvalUxPresent | 是 | 1.0 |
| toolChoiceAccuracy | 否 | 0.85 |
| cancelLatencyMsP95 | 否 | ≤3000 |
