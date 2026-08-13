# agent-output-protocol Specification

## Purpose

定义 Agent Run 从主进程跨越 Electron IPC 到 Renderer 的稳定多阶段输出契约，使执行过程、工具、最终答案、结构化界面与终态具有可验证且互不泄漏的语义边界。

## Requirements

### Requirement: Versioned output event envelope

系统 MUST 使用版本化事件 envelope 传递实时 Run 输出，至少包含 `version`、`runId`、`seq`、`lane`、`type` 与 `payload`；阶段相关事件 MUST 同时携带可机器读取的 `phase`，模型轮相关事件 MUST 携带 `round`。

#### Scenario: Event crosses Electron boundary

- **WHEN** 主进程向 Renderer 发送任一 Agent 输出事件
- **THEN** 事件包含完整版本、Run 标识、单调序号、lane、type 与 payload
- **AND** 事件可通过 `structuredClone`

#### Scenario: Unsupported protocol version

- **WHEN** Renderer 收到不支持的协议版本
- **THEN** 系统 MUST 忽略该事件并将当前 Run 收敛到可读错误态
- **AND** MUST NOT 把未知 payload 直接渲染为正文

### Requirement: Output lanes have exclusive responsibilities

协议 MUST 将 `progress`、`tool`、`answer`、`ui` 与 `terminal` 作为独立 lane；progress/tool 事件 MUST NOT 修改最终回答正文，ui 事件 MUST NOT 以 Markdown 文本展示，terminal 事件 MUST NOT携带主进程内部端口、函数或信号对象。

#### Scenario: Tool step completes

- **WHEN** 工具调用从 started 变为 completed 或 failed
- **THEN** 只更新 tool/progress lane
- **AND** 已提交的 answer 正文保持不变

#### Scenario: Structured choice becomes ready

- **WHEN** 主进程完成结构化选择解析与白名单校验
- **THEN** 通过 ui lane 发送 `choice.ready`
- **AND** 选择 JSON 不进入 answer lane

### Requirement: Event sequence is monotonic and idempotent

同一 Run 的事件 `seq` MUST 严格单调递增；Renderer MUST 忽略重复或早于已消费序号的事件，并在发现序号间隙时保留当前稳定 UI、记录诊断而不是回滚。

#### Scenario: Duplicate event arrives

- **WHEN** Renderer 再次收到已消费 `seq` 的事件
- **THEN** 该事件不产生新的 DOM 更新

#### Scenario: Older answer event arrives late

- **WHEN** 已消费较新 answer 事件后收到较小 `seq`
- **THEN** 已显示正文不被旧事件覆盖或缩短

### Requirement: Canonical answer is committed once

用户可见最终正文 MUST 只由 `answer.committed` 提交；事件 MUST 携带 canonical text 与稳定 hash。提交后同一 Run 的普通 progress、tool、ui 或 terminal 事件 MUST NOT 静默替换、清空或缩短正文。

#### Scenario: Tool round emits provisional prose

- **WHEN** 模型轮最终包含工具调用
- **THEN** 该轮临时 prose 不产生 `answer.committed`
- **AND** Renderer 最终回答区保持空白或已有 canonical 正文

#### Scenario: Canonical answer passes output gate

- **WHEN** candidate 已完成后处理、grounding、声明验证和必要再生成
- **THEN** 系统发送一次 `answer.committed`
- **AND** 其 hash 与持久化正文一致

### Requirement: Run has one explicit terminal event

每个 Run MUST 以 `run.completed`、`run.cancelled` 或 `run.failed` 中且仅一个事件结束；终态之后的非诊断事件 MUST 被忽略。

#### Scenario: User cancels during a tool

- **WHEN** 用户取消仍在执行的 Run
- **THEN** 系统发送 `run.cancelled`
- **AND** 取消结果只包含公开可克隆字段

#### Scenario: Event arrives after completion

- **WHEN** Renderer 已消费 terminal 事件后又收到正文或工具事件
- **THEN** UI 保持终态且忽略迟到事件

### Requirement: Legacy events have bounded compatibility

迁移期系统 MUST 能将旧 `stage`、`tool.*`、`content` 与 `done/error/cancelled` 映射到 v2 envelope；同一 Renderer Run MUST 只消费一个正文来源，MUST NOT 同时消费旧 chunk 与 v2 answer。

#### Scenario: Legacy session resumes

- **WHEN** 加载没有 `protocolVersion` 的历史消息
- **THEN** 正文与 trace 仍可显示
- **AND** 消息不会被当成正在运行的 v2 Run

#### Scenario: V2 run is active

- **WHEN** 当前 Run 已收到 v2 协议事件
- **THEN** 旧 `ai-stream-chunk` 不再更新该 Run 正文
