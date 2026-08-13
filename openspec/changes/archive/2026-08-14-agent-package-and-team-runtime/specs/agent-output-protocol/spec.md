## ADDED Requirements

### Requirement: Sub-run lifecycle maps to orchestration progress lane

v2 输出协议 MUST 支持子 Run 生命周期事件类型：`subrun.started`、`subrun.phase`、`subrun.message`、`subrun.terminal`；这些事件 MUST 走 `progress` lane（或专用 `orchestration` 子 lane），MUST NOT 写入父 Run 的 `answer` lane。

#### Scenario: Sub-run started event

- **WHEN** RunManager 启动真实子 Run
- **THEN** 父 Run 收到 `subrun.started` 含 `parentRunId`、`subRunId`、`expertId`、`builderId`
- **AND** 事件 `seq` 单调递增且可 structuredClone

#### Scenario: Sub-run phase mirrors executor phases

- **WHEN** 子 Run 进入 `TOOL` 或 `VERIFY`
- **THEN** 父 Run 收到 `subrun.phase` 含 `phase` 与 `durationMs`
- **AND** Renderer 时间线可展开子 Run 摘要

#### Scenario: Sub-run events do not commit parent answer

- **WHEN** 子 Run 产生临时 prose 或 tool 结果
- **THEN** MUST NOT 发送父 Run 的 `answer.committed`
- **AND** 父最终回答区保持空白或已有 canonical 正文

### Requirement: Agent message bus envelopes map to output protocol

agent-message-bus 的 `handoff`、`status`、`artifact`、`evidence`、`approval.*` 与 `terminal` MUST 映射为 v2 envelope；映射 MUST 保留 `protocolVersion`、`messageId` 与 `causationId`（父→子）。

#### Scenario: Handoff maps to progress event

- **WHEN** bus 收到 `handoff` 消息
- **THEN** Renderer 收到 `progress`/`subrun.message` 含 handoff 摘要
- **AND** MUST NOT 将 handoff JSON 渲染为 Markdown 正文

#### Scenario: Approval request maps to ui lane

- **WHEN** 子 Run 经 bus 发送 `approval.request`
- **THEN** 通过 `ui` lane 发送可审阅控件（如 draft 卡片）
- **AND** answer lane 保持不变

#### Scenario: Child terminal maps to subrun.terminal

- **WHEN** 子 Run bus 发送 `terminal`
- **THEN** 父 Run 收到 `subrun.terminal` 含 `terminal`、`stopReason`、`summary`
- **AND** 父 Run 自身 terminal 仍单独发送

### Requirement: Parent run preserves single terminal and answer commit

引入子 Run 事件后，父 Run MUST 仍只发送一个 `run.completed|cancelled|failed`；子 Run terminal 事件 MUST NOT 被 Renderer 当作父 Run 终态。

#### Scenario: Child completes before parent

- **WHEN** 子 Run 先发送 `subrun.terminal`
- **THEN** 父 UI 仍显示 running 直到父 `run.completed`
- **AND** MUST NOT 冻结父 Composer

#### Scenario: Parent cancelled cascades sub-run terminal display

- **WHEN** 用户取消父 Run
- **THEN** 父发送 `run.cancelled`
- **AND** 关联子 Run UI 节点 MUST 同步显示 cancelled（经 subrun.terminal 或 batch update）

### Requirement: Sub-run event sequence scoped per runId

每个 Run（父或子）的事件 `seq` MUST 在各自 `runId` 命名空间内单调递增；Renderer MUST 按 `runId` 分区消费，MUST NOT 用子 Run seq 更新父 Run 状态机。

#### Scenario: Duplicate sub-run event ignored

- **WHEN** Renderer 再次收到同一 `subRunId` 的已消费 `seq`
- **THEN** 不产生新的 DOM 更新

#### Scenario: Late sub-run event after parent terminal

- **WHEN** 父 Run 已消费 terminal 后又收到 `subrun.phase`
- **THEN** UI 保持父终态
- **AND** 迟到事件仅写入诊断/Run 树历史

### Requirement: Unsupported bus or output protocol fails closed

Renderer 或 Assembler 收到未知 `protocolVersion`（output 或 bus）时 MUST 将对应 Run 节点收敛到可读错误态，MUST NOT 渲染未知 payload 为正文。

#### Scenario: Unknown output protocol on sub-run stream

- **WHEN** 子 Run 事件 `version` 不受支持
- **THEN** 子 Run 节点显示协议错误
- **AND** 父 Run MAY 继续若自身协议版本有效

#### Scenario: Unknown bus message type

- **WHEN** bus envelope type 不在白名单
- **THEN** 映射为 `subrun.terminal` with `terminal=ERROR, code=protocol_unsupported`
- **AND** MUST NOT 静默忽略
