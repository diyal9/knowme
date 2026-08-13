# agent-run-store Specification

## Purpose

为 KnowMe Agent Team Runtime 提供 append-only Run Event Log、原子快照、checkpoint、幂等收据与留存策略，持久化于 `%APPDATA%\KnowMe\agent-runs\<runId>\`，支持崩溃恢复、审计回放与 fail-closed 幂等，且不引入 Electron 原生数据库依赖，且不持久化密钥或敏感工具参数明文。

## ADDED Requirements

### Requirement: Append-only run event log

每个 runId MUST 拥有独立目录 `%APPDATA%\KnowMe\agent-runs\<runId>\events/`；事件 MUST 以 append-only 方式写入（如 `events/<seq>.json` 或等价 journal）；已写入事件 MUST NOT 原地修改或删除（合规留存策略除外）。

#### Scenario: Event appended on phase transition

- **WHEN** Run 从 PREPARE 进入 CONTEXT
- **THEN** RunStore MUST append 含 runId、seq、phase、timestamp 的事件
- **AND** seq MUST 单调递增

#### Scenario: Existing events immutable

- **WHEN** 恢复或 replay 读取 events/
- **THEN** 历史事件内容 MUST 与首次写入一致
- **AND** MUST NOT 覆盖已有 seq 文件

### Requirement: Atomic run snapshot

RunStore MUST 维护 `state.json` 原子写入：含 Run 树节点、status、phase、governanceEnvelopeHash、packageSnapshotHash、lastSeq；写入 MUST 使用 temp-file + rename 保证崩溃一致性；读取 MUST 返回完整 DTO 或可读 `state_corrupt`。

#### Scenario: Snapshot written atomically

- **WHEN** Run 达到 ORCHESTRATE 且子 Run 列表变更
- **THEN** 新 snapshot MUST 通过 atomic rename 替换旧文件
- **AND** 崩溃中途 MUST NOT 留下半写有效 snapshot

#### Scenario: Corrupt snapshot detected

- **WHEN** state.json 校验失败或 lastSeq 与 events 不一致
- **THEN** 系统 MUST 返回 `state_corrupt`
- **AND** MUST NOT  silent 自动 resume

### Requirement: Checkpoint for resume

RunStore MUST 支持 checkpoint：`checkpoints/<checkpointId>.json` 含 lastSeq、pendingNodes、completedNodes、idemReceipts[] 与 optional joinState；resume MUST 验证 checkpoint 与 Event Log 一致；不一致 MUST fail-closed。

#### Scenario: Checkpoint created before join

- **WHEN** Scheduler 在 join 节点前持久化 checkpoint
- **THEN** checkpoint MUST 记录已完成子 runId 与 lastSeq
- **AND** 崩溃后可从该 checkpoint resume

#### Scenario: Stale checkpoint rejected

- **WHEN** resume 使用的 checkpoint lastSeq 大于当前 Event Log 最大 seq
- **THEN** MUST 返回 `checkpoint_stale`
- **AND** MUST NOT 启动新子 Run

### Requirement: Idempotent side-effect receipts

对可能重复投递的操作（tool 写、artifact accept、remote task ack）RunStore MUST 写入 `receipts/<operationKey>.json`；相同 operationKey 的重复请求 MUST 返回已有结果而不重复副作用；operationKey MUST 由 runId、toolCallId、attempt 或 messageId 确定性构成。

#### Scenario: Duplicate tool write deduplicated

- **WHEN** 同一 toolCallId 的写操作因 retry 再次提交
- **THEN** RunStore MUST 返回已有 receipt 结果
- **AND** MUST NOT 对外部系统执行第二次写

#### Scenario: New operation creates receipt

- **WHEN** 首次成功的 side-effect 完成
- **THEN** MUST 写入 receipt 含 timestamp 与 resultHash
- **AND** 后续 replay MUST 可验证

### Requirement: Run tree index for query and cancel

RunStore MUST 维护 root 级索引（如 `index/by-root/<rootRunId>.json`）映射 runId→parentRunId→status；RunManager 查询、取消与 UI Run 树 MUST 可 O(1) 或低开销定位节点；索引更新 MUST 与 snapshot 同事务或等价一致。

#### Scenario: Query run tree by root

- **WHEN** UI 请求 rootRunId 的完整 Run 树
- **THEN** RunStore MUST 返回所有节点 status 与 parent 链接
- **AND** 与 events replay 结果一致

#### Scenario: Cancel walks index

- **WHEN** 用户取消 rootRunId
- **THEN** RunManager MUST 通过索引枚举所有 active 子 runId
- **AND** 逐个 append cancel 事件

### Requirement: Retention and eviction policy

RunStore MUST 配置 TTL（默认终态 Run 7 天可归档）与容量上限；evict MUST 保留 audit 摘要或 export 包选项；evict 后查询 MUST 返回可读 `not_found` 而非未捕获异常；evict MUST NOT 删除进行中的 Run。

#### Scenario: Terminal run evicted after TTL

- **WHEN** Run 终态超过 TTL 且非 pinned
- **THEN** events 与 snapshot MAY 被 archive 或删除
- **AND** 索引 MUST 更新为 evicted

#### Scenario: Active run never evicted

- **WHEN** Run status 为 running
- **THEN** retention job MUST NOT 删除其目录
- **AND** MUST NOT 截断 Event Log

### Requirement: No secrets in persisted log

RunStore MUST NOT 持久化 API 密钥、OAuth token、password 或完整敏感工具参数；必要字段 MUST redact 或存 secretRef；写入前 MUST 扫描常见 secret 模式并 fail-closed 或 redact；违反 MUST 阻断 persist。

#### Scenario: Sensitive tool args redacted

- **WHEN** tool 事件 payload 含 apiKey
- **THEN** 持久化事件 MUST 仅存 `[REDACTED]` 或 hash
- **AND** replay MUST NOT 恢复明文密钥

#### Scenario: Secret pattern blocks persist

- **WHEN** handoffContext 含未 redact 的 bearer token 且策略为 strict
- **THEN** append MUST 失败并返回 `persist_secret_blocked`
- **AND** Run MUST NOT 继续 until payload 修正

### Requirement: Recovery replay without native database

RunStore MUST 仅依赖文件系统实现上述能力；恢复 MUST 通过 replay events + 读取最新一致 snapshot/checkpoint 完成；集成测试 MUST 验证 kill-process 后 replay 与幂等 receipt 行为。

#### Scenario: Kill and replay restores state

- **WHEN** 测试在 ORCHESTRATE 中途 kill Electron 主进程
- **THEN** 重启后 replay MUST 重建 Run 树至 last consistent seq
- **AND** 未 receipt 的副作用 MUST NOT 自动重放

#### Scenario: No sqlite dependency

- **WHEN** 部署环境无原生 SQL 驱动
- **THEN** RunStore MUST 仍可完成 append、snapshot 与 query
- **AND** MUST NOT 要求安装 Electron 原生数据库
