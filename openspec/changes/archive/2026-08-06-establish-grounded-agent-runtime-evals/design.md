# Design: establish-grounded-agent-runtime-evals

## Context

现状（2026-08-05）：

| 事实 | 位置/含义 |
|---|---|
| Executor 与 Eval 基线已归档入主 spec | `agent-run-executor`、`agent-eval-harness`；`tests/fixtures/agent-eval/*.json` + `tests/agent-eval-harness.js` |
| Grounding 分散且偏事后 | `conversation-grounding.js`（prompt 关键词）、`feishu-grounding.js`（飞书工具结果分析）；无统一 Evidence Ledger |
| 序号选择依赖 NL 改写 | 用户回复「2」时，若 grounding 见 prompt 过短跳过，则不会绑定 structured candidate → 不会强制 `meeting_read` |
| 模型可声明执行态 | 最终输出无 claim-evidence 对齐；UI 可能展示「已读取」类文案而无 tool ledger 支撑 |
| Eval 仅覆盖 Run 指标 | 现有 fixture 断言 phases/toolCalls/terminal；**无**工具选择正确性、事实忠实、拒答、引用绑定等对话维度 |

真实事故：会议候选列表 → 用户「2」→ 未调用 `feishu.meeting_read` → 助手编造议题/责任人/日期并声称已读取。动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 单一 **Grounding Runtime** 模块：ReferenceState + EvidenceLedger + ToolLedger + OutputGate + ClaimVerifier
- Executor 在 `MODEL` 产出最终文本前进入 `GROUND`/`VERIFY`（可映射到既有 `VERIFY` 或新增子阶段），fail-closed
- Skill/Workflow manifest 三元组：`requiredTools`、`requiredEvidence`、`completionConditions`
- Eval 扩展为 **Conversation Eval**：scenario fixtures + 分层 scorer + baseline/threshold + JSON/Markdown 报告 + harness gate
- UI 与时间线消费 ledger/provenance，诚实展示读取/验证状态

**Non-Goals:**

- 不替换全部 connector 实现；Connector 仅负责写入 ReferenceState 与返回结构化 tool result
- 默认不引入在线 LLM judge；L2 语义评分仅 opt-in
- 不在本 Story 删除 legacy grounding 文件（adapter 迁移，feature flag 回滚）
- 不改动并行活跃 change 的产品面

## Decisions

### D1. 三层状态：ReferenceState / EvidenceLedger / ToolLedger

**决策**：

```
ReferenceState（跨轮持久，会话级）
  - refs[]: { id, kind, label, payload, expiresAt?, boundTool? }
  - activeRefId?, pendingSelection?: { refSetId, options[] }
  - taskFrame?: { workflowId, skillId, requiredTools, requiredEvidence }

EvidenceLedger（每 Run 追加，只增不改）
  - entries[]: { id, source: tool|context|user|system, refId?, toolCallId?,
                 status: ok|fail|empty|truncated, digest, provenance, rawRef? }

ToolLedger（权威执行态）
  - calls[]: { id, name, args, status, resultRef?, error?, truncated?: boolean }
  - derivedFacts[]: { key, value, evidenceIds[] }  // 仅工具成功且通过质量门后写入
```

- **ReferenceState** 由 Workflow/Connector UI 卡片写入（如会议候选 `{ minute_token, title, startTime }`），**禁止**从用户「2」NL 解析恢复
- 用户选择序号 → runtime 绑定 `pendingSelection.options[n]` → 改写为 deterministic tool intent（非 LLM 自由发挥）

**理由**：事故根因是「选择未结构化绑定 + prompt 过薄跳过 grounding」。Alternative：继续 NL 改写 — 拒绝，不可测试且易漏。

### D2. Fail-closed OutputGate + ClaimVerifier

**决策**：最终助手文本发出前，OutputGate 扫描 claims（规则表 + 可选 L2）：

| Claim 类型 | 必要条件 | fail-closed 行为 |
|---|---|---|
| 外部事实（日期、人名、议题、数字指标） | EvidenceLedger 有 ok 且非 truncated 的 supporting entry | 剥离/替换为「尚未读取，需先调用 X」 |
| 执行态（已读取/已创建/已发送/已执行） | ToolLedger 对应 status=ok | 禁止输出；改为 honest pending/failed 文案 |
| Workflow completion | completionConditions 满足 | partial 或 blocked 说明 |

**ClaimVerifier 分层**：

- **L0 确定性**（硬门禁）：tool 是否调用、ledger entry 是否存在、ReferenceState 绑定、requiredTools 满足、truncated/empty 标记
- **L1 结构化**（硬门禁）：JSON path 断言、字段集合包含、计数、拒答关键词+无 forbidden claims
- **L2 语义**（软/opt-in）：embedding/LLM judge 仅用于探索性报告，**不**作为 `npm test` 默认 fail

**理由**：用户明确要求不得只依赖 prompt 关键词；Script > Prompt。

### D3. Executor 阶段扩展

**决策**：在 `RunPhase` 增加/明确：

```
... → MODEL → TOOL* → GROUND → VERIFY_CLAIMS → FINALIZE → ...
```

- `GROUND`：合并 tool results 入 EvidenceLedger；评估 requiredEvidence；检测 truncated/empty
- `VERIFY_CLAIMS`：ClaimVerifier + OutputGate；不通过则 **不** 向用户发送编造正文，改为 regen（带 structured blocker prompt）或 honest refusal（预算耗尽时）

与 UI 映射：沿用 `runPhase` 元数据；C 端文案保持「正在核对依据」类中性描述。

**Alternative**：仅在 post-hoc feishu-grounding 拦截 — 拒绝，无法覆盖 Skill/MCP 全工具面。

### D4. Skill/Workflow 声明契约

**决策**：扩展 SKILL.md frontmatter（及 Workflow JSON）：

```yaml
requiredTools:
  - feishu.meeting_read
requiredEvidence:
  - kind: tool_result
    tool: feishu.meeting_read
    minChars: 200
    forbidTruncated: true
completionConditions:
  - type: tool_success
    tool: feishu.meeting_read
  - type: evidence_present
    kind: meeting_minutes_body
```

Runtime 在 task 激活时写入 `ReferenceState.taskFrame`；Completion 由 ledger 判定，**模型无权**在 plan 工具里标记 done 替代。

### D5. Conversation Eval 架构

**决策**：

```
tests/fixtures/agent-conversation-eval/
  scenarios/
    feishu-meeting-pick-2-no-tool.json    # 事故回归
    feishu-meeting-pick-2-happy.json
    numeric-deixis-multiturn.json
    task-switch-stale-facts.json
    tool-budget-conflict.json
    thin-body-title-only.json
  baselines/
    v1-thresholds.json
  mocks/
    tools/feishu.meeting_read.ok.json
```

**Fixture 扩展字段**：

```json
{
  "sessionScript": [ { "role": "assistant", "refs": [...] }, { "role": "user", "input": "2", "bindRef": "candidate-2" } ],
  "llmScript": [...],
  "toolScript": {...},
  "expect": {
    "terminal": "DONE",
    "requiredToolCalls": ["feishu.meeting_read"],
    "forbiddenClaims": ["已读取", "议题："],
    "dimensions": { "toolChoice": 1.0, "factFaithfulness": 1.0, "refusalWhenUnmet": 1.0 }
  }
}
```

**Scorer 输出**（JSON + Markdown）：

- `eval-report.json` / `eval-report.md`
- 维度：toolChoice、toolArgs、contextContinuity、factFaithfulness、refusalWhenUnmet、taskCompletion、formatUx
- `passed` = 所有 hard dimensions ≥ baseline threshold

**CLI**：`node scripts/agent-eval.js --suite conversation --baseline v1`；`npm test` 跑 hard suite；harness gate 可选读取 `evidence/eval-report.json`

### D6. UI Provenance（主进程 → 渲染进程）

**决策**：stream event 增加机器可读字段（不改变用户 Markdown 正文要求）：

```js
{ type: 'grounding-status', status: 'pending|verified|blocked|failed',
  claims: [{ text, evidenceIds[], verified: bool }],
  sources: [{ tool, refId, truncated }] }
```

- 时间线：工具步骤显示 ok/fail/truncated + 「查看来源」
- 助手气泡：**禁止**在无 `verified` 时显示绿色「已读取」徽章；blocked 时显示「需先读取 xxx」

### D7. 多轮边界规则

| 场景 | 规则 |
|---|---|
| 纯数字/指代 | MUST 命中 `pendingSelection` 或 `activeRefId`；否则 fail-closed 要求澄清 |
| 重复 assistant | 新 Run 不继承未验证 claims 为事实；ledger 按 run 分段 |
| 任务切换 | 切换 workflow 时清空 `pendingSelection`；旧 refs 标记 stale |
| 旧事实复用 | 引用 stale ref 时 verifier 要求 re-fetch 或显式 disclaimer |
| 工具预算冲突 | requiredTools 优先于 optional；auto-read 多场 MUST 受 budget 与 explicit workflow 约束 |

### D8. 迁移与 Feature Flag

| 阶段 | 内容 | 回滚 |
|---|---|---|
| A | Grounding runtime 模块 + ledger API；executor 双路径 | `KNOWME_GROUNDING_RUNTIME=legacy` |
| B | ReferenceState 接入飞书会议候选；事故 fixture 红→绿 | legacy grounding adapter |
| C | Skill manifest + UI provenance + conversation eval suite | flag 回 legacy |

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| OutputGate 误杀合法总结 | L0 只拦「执行态 + 无 ledger 的外部事实」；允许「根据您选择的会议，我将读取…」pending 文案 |
| 过度 regen 增加延迟 | 每 Run regen 上限 1；超出则 honest refusal |
| Skill manifest 迁移成本 | 可选字段；缺省行为与现网一致，仅新 Workflow 强制 |
| truncated tool result 误判 | ledger 显式 `truncated: true`；verifier 禁止基于 truncated 生成具体事实 |
| Eval fixture brittle | 维度分层；L0 不依赖 LLM 文本措辞，只查 toolCalls/forbiddenClaims/ledger |

## Migration Plan

1. 落地 runtime 模块与单元测试（无 UI）
2. Executor 接入 GROUND/VERIFY + 飞书 ReferenceState adapter
3. 事故 scenario 变绿后接 UI provenance
4. 扩展 Skill manifest 校验与 eval suite
5. 默认开启 runtime；保留 legacy flag 一个版本周期
6. Story 证据：`evidence/dev-self-test.md`、`evidence/eval-report.json`、`evidence/eval-report.md`、`evidence/test-report.md`

## Open Questions

- `GROUND` 是否作为独立 RunPhase 还是并入 `VERIFY` 子类型 — 实现时以保持 eval `runPhases` 兼容为准，spec 已要求可观测
- 脱敏真实 replay 接口是否本 Story 必做 — 先 mock/fixture 硬门禁；replay adapter 作为 tasks 可选尾项

## Evidence 路径约定

| 路径 | 用途 | 产出角色 |
|---|---|---|
| `evidence/dev-self-test.md` | 开发自测与本地 eval 命令输出摘要 | 开发 |
| `evidence/eval-report.json` | Conversation eval 结构化结果（dimensions/threshold） | 开发/CI |
| `evidence/eval-report.md` | 人类可读 eval 摘要 | 开发/CI |
| `evidence/test-report.md` | 测试 QA 正式报告 | 测试 |
| `evidence/code-review.md` | Code review 结论 | 开发 |
| `evidence/screenshots/` | UI provenance / 诚实状态截图 | 开发/测试/制作人 |
