## ADDED Requirements

### Requirement: Sub-run freezes expert snapshot at spawn

每个子 Run 启动时 MUST 拷贝目标 Expert 及其绑定 skills/connectors 的 manifest hash 到 Run 级快照（`%APPDATA%\KnowMe\agent-runs\<childRunId>/snapshot/`）；子 Run MUST NOT 读取 Hub 实时编辑态。

#### Scenario: Child uses spawn-time persona

- **WHEN** 父 Run delegate 至专家「写作教练」
- **AND** Hub 在 delegate 后修改该专家 systemPrompt
- **THEN** 已启动子 Run 仍使用 spawn 前快照 persona
- **AND** 新 delegate 使用更新后快照

#### Scenario: Snapshot hash recorded in run tree

- **WHEN** 子 Run 启动
- **THEN** RunStore 事件含 expertId 与 snapshot contentHash
- **AND** UI 可展示专家版本摘要

### Requirement: Orchestration policy enforced per sub-run

Expert `orchestration: { allowDelegate, maxParallel, allowedSubExperts }` MUST 在父 Run 与子 Run 各自独立生效；子 Run 的 `delegate_to_expert` 可用性 MUST 由子 Expert 快照 policy 决定。

#### Scenario: Delegate disabled on child expert

- **WHEN** 子 Expert 快照 `allowDelegate=false`
- **THEN** 子 Run 工具面 MUST NOT 暴露 `delegate_to_expert`
- **AND** 试图调用返回 `scope_denied`

#### Scenario: Sub-expert allowlist on nested delegate

- **WHEN** 子 Expert 快照 `allowedSubExperts=['reviewer']`
- **AND** 子 Run 调用 delegate 至 `writer`
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 创建孙 Run

#### Scenario: Max parallel from expert policy

- **WHEN** 子 Expert 快照 `maxParallel=1`
- **THEN** 该子 Run 内并行子 Run 上限为 1
- **AND** 超额请求返回 `parallel_cap`

### Requirement: Sub-run tool surface from registry intersection

子 Run 工具投影 MUST 为 Tool Registry ∩ Expert 快照 bindings ∩ Run 级 allowlist；未注册或 disabled 能力 MUST NOT 出现在子 Run 工具定义。

#### Scenario: Child inherits expert tools only

- **WHEN** 父 Run delegate 至绑定 feishu read 的专家
- **THEN** 子 Run 仅暴露该专家绑定且 enabled 的工具
- **AND** 父 Run 未绑定的高风险写工具 MUST NOT 泄漏到子 Run

#### Scenario: Disabled dependency blocks new child session

- **WHEN** 子 Expert 必需 Connector 已禁用
- **THEN** spawnSubRun MUST fail-closed 且 code=`dependency_unavailable`
- **AND** MUST NOT 启动空工具面子 Run

### Requirement: Cross-builder expert packages validate service compatibility

当 Expert/Agent Package 声明 `builderId` 非 `knowme-local` 时，启用或 spawn 前 MUST 验证 agent-service-protocol 兼容版本；不兼容 MUST 阻止 spawn 并提示升级 Package 或 Runtime。

#### Scenario: Compatible remote expert spawns

- **WHEN** Expert Package 声明 builder=cursor 且 protocol 版本匹配
- **THEN** 子 Run 可启动且 builderId 写入 Run 树
- **AND** Hub 卡片显示 Builder 标签

#### Scenario: Incompatible protocol blocks spawn

- **WHEN** Package 要求 protocol v2 而 Runtime 仅支持 v1
- **THEN** delegate MUST 返回 `builder_incompatible`
- **AND** MUST NOT 启动远程执行

### Requirement: Team package binds multiple experts with workflow roles

Agent Team Package MUST 声明 workflow 节点到 expertId/builderId 的绑定；Orchestration MUST 按 Team manifest 解析 delegate 目标，MUST NOT 允许 Run 调用未声明专家。

#### Scenario: Team workflow serial handoff

- **WHEN** Team Workflow 节点 A→B 串行
- **THEN** 节点 B 子 Run 使用 manifest 中 expertId B 的快照
- **AND** handoff 经 bus 从 A 传递到 B

#### Scenario: Undeclared expert rejected

- **WHEN** 模型 delegate 至 Team manifest 未声明的 expertId
- **THEN** 返回 `scope_denied`
- **AND** MUST NOT 启动子 Run
