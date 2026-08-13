## ADDED Requirements

### Requirement: Tool-capable model prose stays buffered

执行内核 MUST 将工具可用模型轮的正文保存在 Run 内缓冲中，直到该轮完成并确认没有工具调用且计划可交付；包含工具调用、需要恢复或需要继续计划的轮次 MUST NOT 提交最终回答。

#### Scenario: Model returns prose and tool calls

- **WHEN** 同一模型轮返回临时 prose 与一个或多个工具调用
- **THEN** 内核执行工具并只发送 progress/tool 事件
- **AND** 临时 prose 不产生 answer commit

#### Scenario: Plan remains incomplete without tool calls

- **WHEN** 模型轮没有工具调用但计划评估要求继续
- **THEN** 该轮正文继续留在缓冲或被下一轮替代
- **AND** Renderer 不收到可见最终回答

#### Scenario: Direct answer is deliverable

- **WHEN** 模型轮没有工具调用、计划完成且无需再生成
- **THEN** 该轮正文成为 canonicalization candidate

### Requirement: Canonicalization precedes answer commit

执行内核 MUST 在提交 answer 前依次完成产品后处理、grounding ledger 合并、声明验证、输出门禁、必要再生成、输出规范化与结构化 UI 提取；任何步骤产生的修订 MUST 只作用于缓冲 candidate。

#### Scenario: Grounding requests regeneration

- **WHEN** candidate 未通过声明验证且允许再生成
- **THEN** 再生成正文替代缓冲 candidate
- **AND** 被拒绝的 candidate 从未进入 answer lane

#### Scenario: Output gate blocks candidate

- **WHEN** 输出门禁最终阻断回答
- **THEN** canonical answer 为门禁提供的可读拒绝文本
- **AND** 原始未验证正文不向 Renderer 提交

#### Scenario: Suggestion is extracted

- **WHEN** canonical candidate 尾部包含合法 suggestion
- **THEN** answer commit 只含移除 suggestion 后的 Markdown
- **AND** 结构化选择通过 ui lane 单独发送

### Requirement: Persisted answer matches committed answer

持久化到会话的 assistant text MUST 与 `answer.committed` 的 canonical text 和 hash 一致；invoke 返回的完成结果 MUST NOT携带另一个可覆盖 Renderer 的正文版本。

#### Scenario: Run persists successfully

- **WHEN** canonical answer 与结构化 UI 已提交
- **THEN** 会话保存相同正文、hash、protocolVersion、trace 与可选 ui

#### Scenario: Renderer receives invoke result

- **WHEN** `ai-generate` Promise 在 terminal 事件后返回
- **THEN** 结果只用于确认 runId、terminal、sessionId 与公开 metrics
- **AND** Renderer 不用返回正文覆盖消息状态

### Requirement: Executor emits one ordered protocol stream

执行内核 MUST 为每个 Run 分配严格单调事件序号并最终发出一个 terminal 事件；取消、错误和成功结果 MUST 都能安全跨越 Electron IPC。

#### Scenario: Run succeeds

- **WHEN** 持久化完成
- **THEN** 内核在 answer/ui 事件之后发送一个 `run.completed`

#### Scenario: Run fails before answer commit

- **WHEN** 上下文、模型、工具或持久化出现不可恢复错误
- **THEN** 内核发送一个 `run.failed`
- **AND** 不再发送 answer 或普通进度事件

#### Scenario: Run is cancelled

- **WHEN** AbortSignal 在任一可中断阶段触发
- **THEN** 内核发送一个 `run.cancelled`
- **AND** 返回值不包含 ports、函数、AbortSignal 或不可克隆内部对象
