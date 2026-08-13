# Story Done 回顾：establish-grounded-agent-runtime-evals

- 日期：2026-08-06
- 归档：`openspec/changes/archive/2026-08-06-establish-grounded-agent-runtime-evals/`
- 结论：开发自测、制作人验收、正式 QA 与 Story 完成门禁均通过；tasks 40/40。

## 已验证的事故根因

- 会议候选后的纯数字输入（如「2」）原先依赖自然语言改写；短 prompt 可能跳过 grounding，未绑定结构化候选，也未强制调用 `feishu.meeting_read`。
- 最终输出缺少统一的 claim-evidence 校验，模型声明「已读取」或给出议题、责任人、日期时，没有 ToolLedger/EvidenceLedger 作为权威约束。
- 原有 grounding 规则分散在事后关键词拦截中，无法为 Skill、Workflow 与 Function Calling 提供统一、可测试的 fail-closed 保证。

## 已验证的技术经验

- ReferenceState 的 `pendingSelection`、EvidenceLedger、ToolLedger 与 OutputGate 组成可确定性回归的最小闭环；required tool 未成功、结果 empty/truncated 或证据不足时必须阻断具体外部事实。
- Conversation Eval 将 toolChoice、factFaithfulness、refusalWhenUnmet 等 L0/L1 维度纳入离线 hard suite，可在无在线 LLM、无外部 API 的环境复现事故并验证 happy path。
- 用户可见状态必须由 ledger/provenance 驱动；A1 修复确保 bubble/meta 不泄露 raw tool id，A2 修复确保流式/增量更新后来源详情的展开状态保持。
- 等价 E2E 可分层覆盖同一生产链：AgentRunExecutor、飞书只读 connector、GroundingUI 与 Electron 启动；证据中明确标注 controlled fixture 边界，避免把未执行的在线 LLM 流程表述为已执行。

## 门禁与规范结论

- 最新 harness gate：`npm test` PASS（1011/1011），`npm run lint` PASS，`blocking=false`。
- 目标 change 的 `qa-plan` Smoke Scope 与根目录 `code-review.md` 均满足软门禁；harness 输出中的剩余 soft 项均属于其他活跃 change。
- OpenSpec change strict validate PASS，proposal/specs/design/tasks 均 complete，tasks 40/40。
- 七份 delta specs 已逐项同步：新增 `agent-grounding-runtime` 主规范；更新 `agent-chat-ux`、`agent-eval-harness`、`agent-run-executor`、`agent-skills-runtime`、`agent-thinking-timeline`、`connector-feishu-read`，并保留主规范原有内容。
- 归档由 OpenSpec CLI 完成，`.openspec.yaml` 随 change 保留；目标 change 已从 active list 移除。

## 后续 ADVISORY

1. A3：harness gate 尚未直接读取 eval 阈值；当前由 `npm test` 中的 conversation hard suite 与篡改探针覆盖。
2. A4：autoMatch L0 尚不注入 groundingContract；slash 主路径已覆盖。
3. A5：尚未执行在线 LLM 驱动的真实流式 spot-check；正式 QA 已接受等价生产链 E2E。
4. 仓库级 `openspec validate --specs --strict` 仍有既存规范基线问题（54 份中 30 份通过、24 份失败）；本 Story 涉及的新增/更新要求已同步，目标 change strict validate 通过。与本 Story 相关的既存主规范问题包括 `agent-chat-ux` 两条旧 Requirement 缺少 SHALL/MUST，以及 `agent-thinking-timeline` 旧 Purpose 过短；本次未越界修改。

未执行 `/kb-ingest`，未将本回顾升格为团队 OKF。
