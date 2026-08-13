## ADDED Requirements

### Requirement: Conversation scenario fixtures

Eval harness MUST 支持 Conversation Scenario fixture：含 sessionScript（多轮 user/assistant 与 ReferenceState 种子）、llmScript、toolScript、expect.dimensions 与 expect.requiredToolCalls/forbiddenClaims。Fixture MUST 版本化存放于仓库固定目录。

#### Scenario: Load multi-turn session fixture

- **WHEN** 加载含 sessionScript 至少 2 轮的 fixture
- **THEN** harness MUST 按序注入 ReferenceState 与用户输入
- **AND** 不得依赖真实 LLM 或外部 API

#### Scenario: Feishu meeting pick regression fixture

- **WHEN** 运行 `feishu-meeting-pick-2-no-tool`（或等价命名）fixture：候选列表后用户回复「2」，llmScript 跳过 tool_calls
- **THEN** eval MUST fail
- **AND** 报告 MUST 指出 missing requiredToolCalls 与 forbiddenClaims

#### Scenario: Happy path meeting read fixture

- **WHEN** 运行 happy path fixture：绑定 option 2 且 toolScript 返回 ok 正文
- **THEN** eval MUST pass requiredToolCalls 与 factFaithfulness 维度

### Requirement: Layered scoring dimensions

Harness MUST 输出分层评分：至少含 toolChoice、toolArgs、contextContinuity、factFaithfulness、refusalWhenUnmet、taskCompletion、formatUx。L0/L1 维度 MUST 为确定性规则；L2 语义 judge MUST NOT 作为默认 hard fail。

#### Scenario: L0 fails on missing tool only

- **WHEN** requiredToolCalls 未满足但 LLM 文本「看起来正确」
- **THEN** toolChoice 维度 MUST 为 0 或 below threshold
- **AND** overall passed MUST 为 false

#### Scenario: L1 checks forbidden claims without LLM judge

- **WHEN** expect.forbiddenClaims 含「已读取」且输出含该短语且无 ok ledger
- **THEN** factFaithfulness 或 refusalWhenUnmet MUST fail
- **AND** 不得调用在线 LLM judge

### Requirement: Versioned baselines and thresholds

项目 MUST 维护 baselines（如 `v1-thresholds.json`）定义各维度最低分与 hard dimensions 列表。修改 baseline MUST 显式 PR 说明。

#### Scenario: Regression against baseline

- **WHEN** 运行 `npm test` 或 `node scripts/agent-eval.js --baseline v1`
- **THEN** 任一 hard dimension 低于 threshold MUST 导致失败
- **AND** 报告 MUST 打印 dimension vs threshold diff

### Requirement: JSON and Markdown eval reports

Harness MUST 产出 JSON 与 Markdown 报告，含：suite、baseline、per-scenario dimensions、passed、failReasons、durationMs。报告 MUST 可写入 change evidence 路径。

#### Scenario: Write eval report to evidence

- **WHEN** 以 `--out openspec/changes/<change>/evidence/eval-report` 运行
- **THEN** 生成 `eval-report.json` 与 `eval-report.md`
- **AND** JSON MUST 可被 harness gate 解析

### Requirement: Mock tools and optional sanitized replay

Harness MUST 支持 mock toolScript 返回 canned JSON。可选 replay adapter MAY 消费脱敏录制接口，但 hard gate MUST NOT 依赖外网 replay。

#### Scenario: Mock meeting_read returns fixture body

- **WHEN** toolScript 定义 `feishu.meeting_read` 返回固定正文
- **THEN** eval 断言 ledger/evidence 含该 digest
- **AND** 无 feishu CLI 调用

### Requirement: Harness and npm test integration

Conversation eval hard suite MUST 纳入 `npm test`；可选全量 suite 通过 npm script 暴露。CI MUST NOT 要求 API Key。

#### Scenario: Offline conversation eval green

- **WHEN** 无密钥环境运行 `npm test`
- **THEN** conversation hard scenarios 仍执行并通过（在实现完成后）

### Requirement: Cross-skill and function calling coverage

Eval suite MUST 除飞书会议事故外，至少覆盖：纯数字指代、多轮上下文、任务切换 stale 事实、tool budget 冲突、thin-body 标题误判、skill requiredTools 未满足拒答。

#### Scenario: Numeric deixis without pending selection

- **WHEN** scenario 用户发「2」且无 pendingSelection
- **THEN** expect refusalWhenUnmet 通过
- **AND** forbiddenClaims 不含编造议题

#### Scenario: Task switch stale facts

- **WHEN** scenario 切换 workflow 后模型引用旧 ref
- **THEN** factFaithfulness 或 contextContinuity MUST 按 fixture 期望判定
