# agent-message-bus Specification

## Purpose

为 KnowMe 父子 Agent 与跨 Builder 远程 Agent 提供版本化内部 Agent Message Bus，统一 task、handoff、审批、Artifact、Evidence 与终态消息的 envelope、路由、顺序与 fail-closed 语义，使 Orchestration、Executor 与 Workbench UI 共享可审计、可测试的通信契约。

## ADDED Requirements

### Requirement: Versioned message envelope

每条 Bus 消息 MUST 使用 envelope：`version`、`messageId`、`runId`、`parentRunId`、`rootRunId`、`seq`、`type`、`timestamp`、`source`（local|remote|daemon）、`payload`；`seq` 在同一 runId 内 MUST 严格单调递增；未知 `version` MUST fail-closed。

#### Scenario: Envelope crosses orchestration boundary

- **WHEN** 父 Run 向子 Run 发送 task 消息
- **THEN** envelope 含完整 runId 链与单调 seq
- **AND** payload MUST 可通过 structuredClone 或 JSON 序列化

#### Scenario: Unknown envelope version rejected

- **WHEN** Bus 收到 version=99 的消息
- **THEN** 消费者 MUST 丢弃并记录诊断
- **AND** MUST NOT 将未知 payload 渲染为用户可见正文

### Requirement: Core message types

Bus MUST 支持类型：`task.assign`、`task.progress`、`handoff.request`、`handoff.accept`、`handoff.reject`、`approval.request`、`approval.decision`、`artifact.publish`、`evidence.record`、`run.terminal`；每种类型 MUST 有固定 payload schema 且 MUST NOT 混用 lane 语义。

#### Scenario: Handoff request carries bounded context

- **WHEN** 父 Agent 发送 handoff.request
- **THEN** payload MUST 含 targetAgentPackageId、handoffContext（JSON ≤32KB）与 inputSchemaRef
- **AND** 超大小 MUST 返回 `handoff_payload_too_large`

#### Scenario: Terminal closes message stream

- **WHEN** 子 Run 发送 run.terminal type=completed
- **THEN** 同一 runId MUST NOT 再接受非诊断 task 消息
- **AND** 父 Run 可开始 aggregation

### Requirement: Parent-child routing and correlation

Message Bus MUST 按 runId 路由；父→子 MUST 使用 spawn 分配的 subRunId；子→父 MUST 携带 parentRunId 与 correlating messageId；远程 Agent 消息 MUST 经 Agent Service Protocol 映射为等价 envelope 且保留 source 标识。

#### Scenario: Child reply routes to parent

- **WHEN** 子 Run 完成并发送 run.terminal
- **THEN** Bus MUST 交付至 parentRunId 的 Orchestration 处理器
- **AND** correlating messageId MUST 链接原始 task.assign

#### Scenario: Remote message preserves source

- **WHEN** Daemon 回传远程 Builder 进度
- **THEN** envelope source MUST 为 remote
- **AND** UI 时间线 MUST 可区分本地与远程 Agent

### Requirement: Idempotent message consumption

消费者 MUST 按 `messageId` 去重；重复投递 MUST NOT 触发重复副作用；乱序到达且 seq 小于已消费 seq 的非 terminal 消息 MUST 被忽略；seq 间隙 MUST 保留稳定 UI 并记录诊断。

#### Scenario: Duplicate message ignored

- **WHEN** Orchestration 再次收到相同 messageId 的 task.progress
- **THEN** MUST NOT 重复更新 Run 状态或触发工具
- **AND** 返回幂等 ack

#### Scenario: Late old seq ignored

- **WHEN** 已消费 seq=10 后收到 seq=7 的 progress
- **THEN** 该消息 MUST NOT 回滚时间线或正文
- **AND** 诊断日志 MUST 记录 out_of_order

### Requirement: Approval and artifact messages

`approval.request` MUST 含 toolCallId、risk、draftRef 与 expiresAt；`approval.decision` MUST 含 approved|rejected 与用户归因；`artifact.publish` MUST 含 artifactId、type、status、summary 与 workSurfaceRef；未批准前 MUST NOT 发送 evidence.record 标记写操作为 applied。

#### Scenario: Approval blocks evidence

- **WHEN** 工具步骤 pending_review 且未收到 approval.decision
- **THEN** Bus MUST NOT 允许 evidence.record 标记外部写为 verified
- **AND** Workflow 节点 MUST 保持 paused

#### Scenario: Artifact visible in timeline

- **WHEN** 子 Run 发布 artifact.publish
- **THEN** 父 Run 时间线 MUST 展示摘要卡与打开入口
- **AND** 完整审阅 MUST 在 Work Surface

### Requirement: Evidence and terminal aggregation

`evidence.record` MUST 含 claimRef、sourceTool、ledgerEntryHash 与 verificationStatus；`run.terminal` MUST 含 terminal（completed|failed|cancelled）、stopReason、metrics 与 optional outputPayload；父 Run aggregation MUST 合并子 Run evidence 与 error summary，失败 MUST NOT 静默吞掉。

#### Scenario: Failed child terminal surfaces to parent

- **WHEN** 子 Run run.terminal type=failed 含 stopReason
- **THEN** 父 Run MUST 收到结构化 error summary
- **AND** join 节点 MUST 按 joinStrategy 处理或上浮错误

#### Scenario: Evidence merges into parent ledger

- **WHEN** 子 Run 发送 verified evidence.record
- **THEN** 父 Run EvidenceLedger MUST 可引用子 claim
- **AND** 汇总 MUST NOT 丢失 provenance

### Requirement: Fail-closed security on bus ingress

Bus ingress MUST 校验 runId 属于当前 Session/Team 授权范围；跨 runId 注入、未知 type 与未授权 remote source MUST 拒绝；handoffContext MUST 经过 schema 与大小校验；MUST NOT 默认复制父会话完整历史到子 Agent。

#### Scenario: Cross-run injection rejected

- **WHEN** 消息 runId 不属于当前授权 Run 树
- **THEN** Bus MUST 拒绝并返回 `bus_unauthorized`
- **AND** MUST NOT 交付给 Orchestration

#### Scenario: Child does not receive full parent transcript

- **WHEN** 子 Run 启动
- **THEN** 初始上下文 MUST 仅含 task.assign 与声明的 handoffContext
- **AND** MUST NOT 含父 Run 完整 tool 细节或模型推理草稿
