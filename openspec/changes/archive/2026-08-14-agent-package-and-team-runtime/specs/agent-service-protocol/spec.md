# agent-service-protocol Specification

## Purpose

定义 KnowMe 与本地 Executor、Cursor/Claude 兼容 Builder 包及 Workbench Daemon 之间的 Agent Service Protocol，统一能力握手、任务提交、进度回传、取消、恢复与兼容错误语义，使跨 Builder 的 Agent 可在同一 Team Workflow 中互操作且未知协议版本 fail-closed。

## ADDED Requirements

### Requirement: Versioned protocol handshake

Agent Service 连接 MUST 以 handshake 开始，交换 `protocolVersion`、`builderId`、`supportedCapabilities[]`、`runStoreCompat` 与 `authMode`；双方 MUST 协商至共同最高兼容版本；不支持的 `protocolVersion` MUST fail-closed。

#### Scenario: Compatible handshake succeeds

- **WHEN** 本地 Launcher 连接 Workbench Daemon 且双方均支持 protocolVersion=1
- **THEN** handshake 返回 negotiatedVersion=1 与 capability 交集
- **AND** 后续消息 MUST 使用该版本 envelope

#### Scenario: Unknown protocol version rejected

- **WHEN** 远程服务声明仅支持 protocolVersion=99
- **THEN** handshake MUST 失败并返回 `protocol_version_unsupported`
- **AND** MUST NOT 以 silent downgrade 继续执行任务

### Requirement: Capability advertisement and task binding

握手后 Agent Service MUST 暴露可执行任务类型：`executeAgentRun`、`cancelRun`、`resumeRun`、`fetchRunStatus`；任务提交 MUST 绑定 `runId`、`agentPackageId`、`packageSnapshotHash`、`governanceEnvelope` 与 `inputPayload`；服务端 MUST 拒绝 snapshot 与本地声明不一致的任务。

#### Scenario: Task bound to package snapshot

- **WHEN** Launcher 提交 agentPackageId=v1.0.0 且 snapshotHash 匹配
- **THEN** 服务端 MUST 使用该 snapshot 装配 persona 与工具投影
- **AND** MUST NOT 漂移至 Hub 最新未锁定版本

#### Scenario: Snapshot mismatch rejected

- **WHEN** 提交的 packageSnapshotHash 与服务端解析结果不一致
- **THEN** 任务 MUST 被拒绝并返回 `snapshot_mismatch`
- **AND** MUST NOT 启动 Run

### Requirement: Task lifecycle over service boundary

`executeAgentRun` MUST 返回可流式或轮询的 Run 生命周期：accepted → running → terminal；进度 MUST 映射为 Agent Message Bus 等价事件；terminal MUST 为 `completed`、`failed` 或 `cancelled` 之一且仅一次。

#### Scenario: Remote run emits progress

- **WHEN** 远程 Agent 执行工具步骤
- **THEN** 服务端 MUST 向 Launcher 推送 progress/tool 等价消息
- **AND** 本地 Run 树节点 status 保持 running

#### Scenario: Remote terminal is singular

- **WHEN** 远程 Run 成功完成
- **THEN** 服务端 MUST 发送一次 terminal=completed
- **AND** 后续非诊断消息 MUST 被 Launcher 忽略

### Requirement: Cancel and resume service operations

Agent Service MUST 支持 `cancelRun(runId)` 与 `resumeRun(runId, checkpointRef)`；cancel MUST 在 **≤3s** 内使远程 Run 达到 cancelled 或返回不可取消原因；resume MUST 携带 checkpointRef 与幂等 receipt 且 MUST NOT 重复已提交副作用。

#### Scenario: Cancel propagates to remote

- **WHEN** 用户取消绑定远程 Agent 的子 Run
- **THEN** Launcher MUST 调用 cancelRun 且远程在 3s 内 cancelled
- **AND** 本地 Run 树同步 CANCELLED 终态

#### Scenario: Resume requires valid checkpoint

- **WHEN** resumeRun 提交无效或过期 checkpointRef
- **THEN** 服务 MUST 返回 `resume_invalid`
- **AND** MUST NOT 启动新的 executeAgentRun 实例

### Requirement: Structured compatibility error taxonomy

协议错误 MUST 使用稳定 code：`protocol_version_unsupported`、`snapshot_mismatch`、`capability_missing`、`auth_required`、`budget_exceeded`、`cancel_timeout`、`resume_invalid`、`remote_unavailable`；客户端 MUST 将错误上浮至父 Run 与 UI，MUST NOT 静默吞掉。

#### Scenario: Missing remote capability surfaces error

- **WHEN** Team Workflow 需要 remote-only 能力但 handshake 交集为空
- **THEN** 启动 MUST 失败并返回 `capability_missing` 含缺失 capability id
- **AND** 父 Run 收到结构化 error summary

#### Scenario: Auth required blocks execution

- **WHEN** Connector 授权缺失且 authMode=requireUser
- **THEN** 任务 MUST 暂停并返回 `auth_required`
- **AND** MUST NOT 以匿名凭证继续

### Requirement: Local executor and daemon equivalence

本地 AgentRunExecutor 与 Workbench Daemon MUST 实现同一 protocol 语义子集；集成测试 MUST 验证同一 Team fixture 在 local-only 与 daemon-backed 模式下行为等价（除 latency）；Cursor/Claude 兼容包 MUST 通过 adapter 映射至同一 task binding 字段。

#### Scenario: Local and daemon pass same fixture

- **WHEN** eval harness 运行跨 Builder Team fixture
- **THEN** local Executor 与 Daemon 模式 MUST 均完成串行 handoff 与 join
- **AND** 终态与 evidence 摘要语义一致

#### Scenario: Cursor package maps to task binding

- **WHEN** Builder 为 Cursor 兼容 Agent
- **THEN** adapter MUST 填充 agentPackageId、persona 与 governanceEnvelope
- **AND** handshake builderId MUST 标识来源 Builder

### Requirement: Secrets and sensitive params never cross boundary in plaintext

Agent Service 消息 MUST NOT 在 Event Log 或网络 payload 中持久化 API 密钥、OAuth token 或敏感工具参数明文；必要引用 MUST 使用 secretRef 或本地 vault 句柄；违反 MUST 在发送前 fail-closed。

#### Scenario: Tool args redacted in service log

- **WHEN** 远程工具调用含 password 字段
- **THEN** 持久化日志 MUST 仅存 redacted 摘要或 hash
- **AND** 完整明文 MUST NOT 写入 `%APPDATA%` Run Event Log
