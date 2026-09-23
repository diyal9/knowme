# Delta Spec: agent-output-protocol

## MODIFIED Requirements

### Requirement: Event sequence is monotonic and idempotent

同一 Run 的事件 `seq` MUST 严格单调递增；Renderer reducer MUST 对事件返回可机器读取的处理判定，至少区分 `applied`、`duplicate`、`late`、`frozen`、`invalid` 和 `unsupported_version`。重复、早于已消费序号、终态后或无效的 V2 事件 MUST 被忽略并记录有界诊断，MUST NOT 进入 legacy 正文 fallback。序号间隙 MAY 应用较新事件，但 MUST 保留当前稳定 UI 并记录 gap 诊断。

#### Scenario: Duplicate event arrives

- **WHEN** Renderer 再次收到已消费 `seq` 的 V2 事件
- **THEN** reducer 返回 `duplicate`
- **AND** 该事件不产生 DOM 更新或正文 fallback

#### Scenario: Older answer event arrives late

- **WHEN** 已消费较新 answer 事件后收到较小 `seq`
- **THEN** reducer 返回 `late`
- **AND** 已显示正文不被旧事件覆盖或缩短

#### Scenario: Event arrives after terminal

- **WHEN** Run 已冻结并收到新的 answer 或 progress 事件
- **THEN** reducer 返回 `frozen`
- **AND** 事件不得经 fallback 改写正文或重新打开 busy 状态

#### Scenario: Sequence gap arrives

- **WHEN** 新事件 `seq` 大于 `lastSeq + 1`
- **THEN** Renderer 记录 gap 诊断并保持已有稳定区域
- **AND** 若事件本身有效 MAY 应用该事件，MUST NOT 回滚等待缺失序号

### Requirement: Canonical answer is committed once

用户可见最终正文 MUST 只由 `answer.committed` 提交；事件 MUST 携带 canonical text、稳定 hash，并关联当前 `assistantMessageId`。同一 `runId + assistantMessageId + hash` MUST 幂等 upsert 到同一消息。提交后同一 Run 的 progress、tool、ui、terminal、恢复或任务引用 MUST NOT 创建第二份回答正文，也 MUST NOT 静默替换、清空或缩短正文。

#### Scenario: Tool round emits provisional prose

- **WHEN** 模型轮最终包含工具调用
- **THEN** 该轮临时 prose 不产生 `answer.committed`
- **AND** Renderer 最终回答区保持空白或已有 canonical 正文

#### Scenario: Canonical answer passes output gate

- **WHEN** candidate 已完成后处理、grounding、声明验证和必要再生成
- **THEN** 系统发送一次 `answer.committed`
- **AND** 其 message ID、hash 与持久化正文一致

#### Scenario: Persisted answer is restored after refresh

- **GIVEN** canonical answer 已持久化且实时事件也曾到达
- **WHEN** 页面刷新并从 Session 与 Run 数据恢复
- **THEN** 使用同一 `assistantMessageId` upsert 一条回答
- **AND** 不因存在 task event 或 attention record 再生成第二条正文

### Requirement: Legacy events have bounded compatibility

迁移期系统 MUST 能将声明为 legacy 的 `stage`、`tool.*`、`content` 与 `done/error/cancelled` 映射到 v2 envelope；同一 Renderer Run MUST 只消费一个正文来源。已经带 V2 envelope 的事件无论 applied 或 rejected，都 MUST 服从 V2 reducer 判定，MUST NOT 因 `changed=false` 或内部 fallback 分支再次按 legacy 正文处理。

#### Scenario: Legacy session resumes

- **WHEN** 加载没有 `protocolVersion` 的历史消息
- **THEN** 正文与 trace 仍可显示
- **AND** 消息不会被当成正在运行的 v2 Run

#### Scenario: V2 run is active

- **WHEN** 当前 Run 已收到 v2 协议事件
- **THEN** 旧 `ai-stream-chunk` 不再更新该 Run 正文

#### Scenario: Rejected V2 answer event reaches compatibility layer

- **WHEN** reducer 将 V2 `answer.committed` 判定为 duplicate、late、frozen 或 invalid
- **THEN** compatibility layer MUST ignore it
- **AND** MUST NOT 调用 committed-text fallback

## ADDED Requirements

### Requirement: Derived task surfaces reference canonical messages

Task timeline、attention card 和专家 feed MUST 通过稳定 `messageId` 引用 canonical Session message。派生记录 MAY 保存有界摘要用于审计或无消息兼容显示，但 MUST NOT 在 canonical message 存在时作为第二个助手回答渲染。

#### Scenario: Task event references the committed answer

- **GIVEN** Session 已有 `assistantMessageId=A` 的 canonical answer
- **WHEN** Task event 记录同一结果并引用 A
- **THEN** 专家对话区只显示 Session message A
- **AND** Task event 只更新状态、时间线或动作区

#### Scenario: Legacy task event has no message reference

- **GIVEN** 历史任务只有旧 Task event 正文且没有 Session message
- **WHEN** 页面恢复历史任务
- **THEN** compatibility projection MAY 显示该历史正文一次
- **AND** 不创建伪造的当前时间、当前 runId 或用户消息
