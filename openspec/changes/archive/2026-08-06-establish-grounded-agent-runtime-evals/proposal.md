# Proposal: establish-grounded-agent-runtime-evals

## Why

KnowMe Agent 已具备 `AgentRunExecutor` 与 mock-replay Eval 基线，但**防幻觉与可证据化执行**仍分散在 `conversation-grounding.js`、`feishu-grounding.js` 等事后关键词拦截中：模型可在未调用工具时自行声明「已读取/已创建/已执行」，并在纯数字选择（如会议候选「2」）因 prompt 过薄而跳过 grounding，直接编造议题、责任人与日期。真实事故已发生，且仓库无固定 mock 可掩盖。

在继续扩展 Skill、Workflow 与 Connector 之前，必须把**结构化引用、证据账本、fail-closed 输出与 claim-evidence 校验**提升为所有 Skill 与 Function Calling 共用的 runtime 平台能力，并建立**可持续、可版本化、可回归**的 Agent 对话评测系统——否则每新增一个工具面都会重复同类幻觉风险，且无法量化修复效果。

## 目标用户

- **C 端用户（办公/知识工作者）**：需要助手回答基于真实读取结果，而非「看起来已读取」的编造总结；UI 应诚实展示读取/验证状态与来源
- **开发/架构**：需要 deterministic runtime 规则与 eval 门禁，在不依赖真实 LLM/飞书的情况下回归「回复 2 无 meeting_read」等事故
- **制作人/QA**：需要多维度评分、基线/阈值与 JSON+Markdown 报告，接入 harness/gate 作为 Story 完成硬项
- **Skill/Workflow 作者**：需要声明 `requiredTools`、`requiredEvidence`、`completionConditions`，由 runtime 强制执行而非仅靠 prompt

## What Changes

- **新增 `agent-grounding-runtime` 平台能力**：结构化任务/引用状态（ReferenceState）、每轮 Evidence Ledger、Tool Ledger 权威状态、fail-closed 最终输出门、claim-evidence verifier（确定性规则优先）
- **升级 Eval Harness**：版本化 fixtures/scenarios、mock 工具、脱敏 replay 接口、分层评分维度、基线/阈值、回归 CLI，纳入 `npm test` / harness gate
- **Executor 集成 GROUND/VERIFY 证据阶段**：在 MODEL 最终输出前消费 ledger + verifier；工具未调用/失败/空结果/截断/证据不足时拒绝生成具体外部事实
- **Skill/Workflow 契约扩展**：SKILL.md / Workflow manifest 声明 requiredTools、requiredEvidence、completionConditions；runtime 绑定 ReferenceState 而非解析自然语言气泡恢复选择
- **UI 诚实状态**：时间线与助手气泡展示读取/验证状态、来源 provenance；禁止在无 ledger 证据时显示「已读取」
- **重点回归事故 fixture**：「会议候选 + 用户回复 2 + LLM 跳过 meeting_read 却输出总结」及多轮指代、任务切换、旧事实复用、工具预算冲突等边界
- **分层评测设计**：L0 确定性规则（工具调用、ledger、引用绑定）为主门禁；L1 结构化断言（字段/计数/拒答）；L2 可选语义 judge（非默认硬门禁）

## Capabilities

### New Capabilities

- `agent-grounding-runtime`：结构化引用状态、证据/工具账本、fail-closed 输出、claim-evidence verifier、多轮上下文边界；所有 Skill 与 Function Calling 共用

### Modified Capabilities

- `agent-eval-harness`：对话能力评测系统（fixtures/scenarios、mock/replay、多维度评分、报告、基线/阈值、harness 集成）
- `agent-run-executor`：GROUND/VERIFY 证据阶段与 ledger 生命周期集成
- `agent-skills-runtime`：Skill/Workflow 声明 requiredTools、requiredEvidence、completionConditions
- `agent-thinking-timeline`：证据读取/验证状态与来源 provenance 展示
- `agent-chat-ux`：助手输出区的诚实读取/验证状态，禁止无证据「已读取」假象
- `connector-feishu-read`：会议候选等 Connector 输出 MUST 写入 ReferenceState 供 runtime 绑定（不依赖 NL 解析恢复序号）

## Non-goals

- 不一次性重写全部 ContextCompiler / 所有 Connector 实现；Phase 1 以 runtime 门控 + eval 回归为主
- 不要求所有自然语言事实都做昂贵 LLM judge；默认硬门禁为确定性 L0/L1
- 不引入 CI 硬依赖真实 LLM API、飞书/MCP 在线连通（脱敏 replay 为可选扩展）
- 不合并当前活跃 change（workbench、feishu empty state、brand icon 等）的范围
- 不在本 Story 实现代码（仅 OpenSpec 规划）

## 验收标准

- OpenSpec change 含 proposal、design、delta specs、tasks、qa-plan（Smoke Scope 已填）、acceptance.md；`openspec validate` 与 status 显示 **apply-ready**
- Delta specs 覆盖用户列出的 10 项平台能力（结构化引用、Skill 契约、ledger 权威、fail-closed、verifier、多轮边界、UI 诚实、eval 系统、事故回归、分层评测）
- tasks 可交给开发按序实现；每项 task 映射至少一条 spec scenario
- qa-plan 含「回复 2 无 meeting_read」事故回归与 eval 报告路径约定
- evidence 目录约定明确（dev-self-test、eval-report、test-report、screenshots）

## Impact

| 区域 | 变更 |
|---|---|
| `src/lib/agent-grounding-runtime.js`（或等价） | **新增**：ReferenceState、EvidenceLedger、ClaimVerifier、OutputGate |
| `src/lib/agent-run-executor.js` | **修改**：GROUND/VERIFY 证据阶段、ledger 注入 ports |
| `src/lib/conversation-grounding.js`、`feishu-grounding.js` | **迁移/薄化**：规则迁入 runtime；保留 adapter 钩子 |
| `src/lib/agent-skills-runtime.js`、Workflow manifest | **修改**：解析并执行 requiredTools/Evidence/Completion |
| `src/renderer/` Agent 时间线与气泡 | **修改**：provenance / 验证状态 UI |
| `tests/fixtures/agent-eval/`、`tests/agent-conversation-eval/` | **新增/扩展**：scenarios、dimensions、baseline |
| `tests/agent-eval-harness.js` | **扩展**：多维度评分、threshold、Markdown 报告 |
| `scripts/agent-eval.js`、`package.json` | **扩展**：`npm run test:agent-eval` / gate 集成 |
| `.cursor/scripts/harness.js` | **可选**：gate 软/硬项引用 eval 阈值 |

依赖：建立在已有 `agent-run-executor` 与 `agent-eval-harness` 主 spec 之上；无新增 npm 包要求。
