# QA Plan: establish-grounded-agent-runtime-evals

## Smoke Scope（必填）

- [ ] **事故回归**：会话含会议候选 → 用户仅回复「2」→ 若 LLM 未发起 `feishu.meeting_read`，最终输出不得含具体议题/责任人/日期，不得出现虚假「已读取」；eval fixture `feishu-meeting-pick-2-no-tool` 必须 fail。
- [ ] **Happy path**：结构化绑定 option 2 → 调用 `feishu.meeting_read` → ok 正文 → 总结字段可追溯到 ledger provenance；UI 可查看来源。
- [ ] **Fail-closed**：requiredTools 未满足或 truncated/empty 结果时，助手拒答具体外部事实并给出下一步（非 silent 编造）。
- [ ] **Eval 门禁**：无 API Key 环境 `npm test` 通过 conversation hard suite；`eval-report.json` 各 hard dimension ≥ baseline v1。
- [ ] **UI 诚实**：无 ToolLedger ok 时，助手区/时间线不展示「已读取」成功态；blocked 时可见原因与建议动作。

## Regression Scope

- 既有 `tests/fixtures/agent-eval/*` Run 指标用例（phases/toolCalls/terminal）不退化。
- `KNOWME_AGENT_EXECUTOR=legacy` 与 `KNOWME_GROUNDING_RUNTIME=legacy` 回滚路径仍可用（至少一个版本周期）。
- 未声明 grounding 三元组的 legacy skill/chat 行为不被误伤阻断。
- 飞书 scope/auth 失败路径仍展示真实原因（与 feishu-grounding adapter 一致）。
- 时间线流式增量 DOM 行为不退化（展开/折叠状态保持）。

## Anti-pattern Checks（交给测试）

- 用户发「2」但系统从 Markdown 列表 NL 猜候选，而非 ReferenceState 绑定。
- 工具未调用却输出「已读取妙记/文档」或完整会议总结。
- 仅标题/包装字段被当作有效正文证据生成议题与待办。
- tool result 截断后仍输出精确日期、责任人、指标。
- 任务切换后静默复用 stale 会议/文档事实当作「刚读取」。
- tool 预算耗尽前 requiredTools 被 optional auto-read 挤占。
- UI 绿色「已读取」徽章与 ledger 状态不一致（制造假象）。
- Eval 仅断言 phases 而未断言 requiredToolCalls/forbiddenClaims。
- 默认 hard gate 依赖在线 LLM judge 导致 CI 不稳定。

## Eval 与证据路径

| 产物 | 路径 |
|---|---|
| 开发自测 | `evidence/dev-self-test.md` |
| Eval JSON | `evidence/eval-report.json` |
| Eval Markdown | `evidence/eval-report.md` |
| 测试报告 | `evidence/test-report.md` |
| Code review | `evidence/code-review.md` |
| 截图 | `evidence/screenshots/` |

回归命令（实现后）：

```bash
npm test
npm run lint
node scripts/agent-eval.js --suite conversation --baseline v1 --out openspec/changes/establish-grounded-agent-runtime-evals/evidence/eval-report
node .cursor/scripts/harness.js gate --json
```

## 维度阈值（baseline v1 草案）

| 维度 | Hard | 最低分 |
|---|---|---|
| toolChoice | 是 | 1.0 |
| factFaithfulness | 是 | 1.0 |
| refusalWhenUnmet | 是 | 1.0 |
| contextContinuity | 是 | 0.9 |
| toolArgs | 否 | 0.8 |
| taskCompletion | 否 | 0.8 |
| formatUx | 否 | 0.7 |
