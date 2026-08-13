## ADDED Requirements

### Requirement: Agent timeline shows persisted run tree

工作台 Agent 意图/轨迹区 MUST 展示持久化 Run 树：父 Run 为根，子 Run 为可展开节点；每节点 MUST 显示 expertId、builderId、phase、terminal 与 stopReason。

#### Scenario: Expand child run summary

- **WHEN** 父 Run 委派子 Run 且子 Run 执行工具
- **THEN** 时间线出现可展开子节点
- **AND** 展开后可见 phase 摘要而 MUST NOT 嵌套全部工具细节

#### Scenario: Cross-builder label visible

- **WHEN** 子 Run builderId 为 cursor 或 claude
- **THEN** 节点 MUST 显示 Builder 标签
- **AND** 与 knowme-local 子 Run 视觉可区分

#### Scenario: Terminal stop reason readable

- **WHEN** 子 Run 以 ERROR 或 CANCELLED 终止
- **THEN** 节点 MUST 显示 stopReason 中文摘要
- **AND** MUST NOT 仅显示 failed 图标无文案

### Requirement: Handoff approval artifact and evidence panels

Run 树或时间线 MUST 支持查看 bus handoff、pending approval、artifactRefs 与 evidence digest；输入路径 MUST NOT 被误标为产物。

#### Scenario: Handoff card shows source and target

- **WHEN** handoff 含 requirementId 与 target expert
- **THEN** UI 展示 handoff 来源节点与目标 expert
- **AND** 点击 MAY 跳转 Run 树对应子节点

#### Scenario: Approval request opens review surface

- **WHEN** 子 Run 产生 `approval.request`
- **THEN** Work Surface 或 inline 卡片展示 draft 审阅
- **AND** 批准前 MUST NOT 显示为已完成外部写

#### Scenario: Evidence digest not rendered as answer

- **WHEN** 子 Run 产出 evidence digest
- **THEN** 在 Run 树 evidence 区展示摘要
- **AND** MUST NOT 写入父 Run 最终 Markdown 正文

### Requirement: Run tree cancel retry and resume controls

用户对 Run 树节点 MUST 可触发 cancel；对 supported 终态（ERROR/可恢复 CANCELLED）MAY 触发 retry；崩溃后可恢复 Run MUST 提供 resume 入口。

#### Scenario: Cancel child from tree

- **WHEN** 用户点击 running 子 Run 节点的取消
- **THEN** RunManager 取消该子 Run
- **AND** ≤3s 内节点显示 cancelled

#### Scenario: Cancel parent cascades tree UI

- **WHEN** 用户取消父 Run
- **THEN** 所有 running 子节点同步显示 cancelled
- **AND** MUST NOT 遗留 spinning 子节点

#### Scenario: Resume interrupted team workflow

- **WHEN** 应用重启且 RunStore 含可恢复 Team Workflow Run
- **THEN** 工作台 MUST 显示 resume 提示（可与悬浮入口状态提示协调）
- **AND** 用户确认后从 checkpoint 继续

#### Scenario: Retry failed child when policy allows

- **WHEN** 子 Run 节点 terminal=ERROR 且 Team policy 允许 retry
- **THEN** 节点 MUST 显示重试操作
- **AND** 重试后创建新 subRun 节点并关联 attempt

### Requirement: Sub-run events do not break parent answer lane

Run 树与子 Run 进度更新 MUST 使用 progress/orchestration lane；父 Run 最终回答区 MUST 仍只由 `answer.committed` 更新，且父 terminal 后 UI 冻结。

#### Scenario: Child progress does not fill answer bubble

- **WHEN** 子 Run 仅产生 tool/progress 事件
- **THEN** 父助手气泡 MUST NOT 显示子 Run 临时 prose
- **AND** 最终回答区保持空白直至父 answer commit

#### Scenario: Parent terminal freezes composer

- **WHEN** 父 Run 收到 `run.completed|cancelled|failed`
- **THEN** Composer 进入终态
- **AND** 迟到 subrun 事件 MUST NOT 重新启用发送

### Requirement: Daemon task view aligns with agent run tree semantics

当 Workbench 同时展示 Daemon 任务与 Agent Team Run 时，状态语义 MUST 一致：degraded 图 MUST NOT 显示假 100% 进度；Agent Run 树 MUST NOT 将任务输入路径标为 artifact。

#### Scenario: Agent run tree and daemon progress consistent

- **WHEN** Team Workflow 经 Daemon 启动且 Agent Run 树显示 running
- **THEN** 任务工作间 MUST NOT 显示与 Run 树矛盾的 done·100%
- **AND** degraded 时两处均显示无法确认进度类文案

#### Scenario: Input path not shown as team artifact

- **WHEN** Team context 含 inputs.prd 路径
- **THEN** Run 树 artifact 区 MUST NOT 将该输入列为产物
- **AND** 仅 Daemon `/artifacts` 或 bus artifactRefs 可展示

### Requirement: Run event log privacy in UI

Run 树与详情 MUST NOT 展示密钥、token 或敏感工具参数明文；脱敏规则 MUST 与 audit presenter 一致。

#### Scenario: Sensitive param redacted in tree detail

- **WHEN** 用户展开含 authorization 参数的工具步骤
- **THEN** UI 显示 `[REDACTED]`
- **AND** MUST NOT 可复制明文 secret
