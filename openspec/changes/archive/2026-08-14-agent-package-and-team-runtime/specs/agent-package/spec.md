# agent-package Specification

## Purpose

为 KnowMe Agent Team 提供版本化、可校验、可导入的 Agent Package 与 Team Package 声明契约，统一 persona、能力绑定、输入输出 schema、Workflow/DAG、门禁与测试元数据，使不同 Builder 产出的专业 Agent 可在 KnowMe Runtime 中安全发现、锁定版本并参与同一 Team Workflow。

## ADDED Requirements

### Requirement: Agent Package manifest structure

单个 Agent Package MUST 位于 `agents/<packageId>/`，包含 `agent.package.json`（schemaVersion、packageId、name、version、builder、persona、capabilities、inputs、outputs、gates、tests、compatibility）及可选 `README.md`；`packageId` MUST 为小写 kebab-case，`version` MUST 为 semver。

#### Scenario: Valid agent package is discovered

- **WHEN** 目录包含合法 `agent.package.json` 且 persona 与 inputs/outputs schema 完整
- **THEN** 系统 SHALL 返回 packageId、name、version、builder、能力摘要与门禁摘要
- **AND** MUST NOT 写入 install store 前跳过 schema 校验

#### Scenario: Invalid packageId rejected

- **WHEN** `packageId` 含大写、空格或非法字符
- **THEN** 导入 MUST 失败并返回字段级可读错误
- **AND** MUST NOT 部分写入磁盘

### Requirement: Team Package declares workflow DAG

Team Package MUST 使用 `team.package.json` 声明 `members[]`（agentPackageId、role、optional gateRef）与 `workflow`（nodes、edges、joinStrategy、parallelism）；DAG MUST 无环且所有 member 引用 MUST 可解析。

#### Scenario: Valid team DAG accepted

- **WHEN** Team Package 含串行 A→B 与并行 C/D 汇聚至 E 的合法 DAG
- **THEN** 校验通过并返回可执行 workflow 摘要
- **AND** joinStrategy 默认为 `allSucceeded`

#### Scenario: Cyclic workflow rejected

- **WHEN** workflow edges 形成直接或间接环
- **THEN** 校验 MUST 失败并返回环路径
- **AND** MUST NOT 注册该 Team Package

### Requirement: Input and output JSON Schema binding

Agent Package MUST 为 `inputs` 与 `outputs` 提供 JSON Schema（或等价 `$ref`）；Runtime 启动 Run 前 MUST 校验 handoff/任务 payload 符合 inputs schema；子 Run 终态产物 MUST 校验符合 outputs schema 后才可 handoff 回父 Run。

#### Scenario: Handoff payload fails schema

- **WHEN** 父 Run 向子 Agent 传递不符合 inputs schema 的 handoff
- **THEN** 子 Run MUST NOT 启动
- **AND** 返回 `handoff_schema_invalid` 含字段路径

#### Scenario: Output validated before aggregation

- **WHEN** 子 Run 完成且 outputs 缺少 required 字段
- **THEN** 父 Run MUST 收到结构化 `output_schema_invalid`
- **AND** MUST NOT 静默合并无效产物

### Requirement: Capability bindings reference unified manifest

Agent Package MUST 通过 capability-manifest v2 引用 Expert、Skill、Connector 与 Workflow 依赖；MUST NOT 内嵌重复的原子能力 schema；启用前 MUST 验证 required 依赖存在且 enabled。

#### Scenario: Missing required capability blocks enable

- **WHEN** Agent Package 声明 required Skill 未安装
- **THEN** 启用 MUST 被阻止并列出缺失 capability id
- **AND** 已有 Session 快照 MUST 保持可读

#### Scenario: Bindings resolve to tool projection

- **WHEN** Agent Package 成功启用并启动 Run
- **THEN** 工具投影 MUST 来自 Registry 与绑定能力的交集
- **AND** 每个工具契约 MUST 可见 risk 与 requiresApproval

### Requirement: Gates and tests are first-class metadata

Agent 与 Team Package MUST 声明 `gates[]`（id、type: smoke|approval|budget|evidence、params）与 `tests[]`（id、fixtureRef、expectation）；Team Workflow 节点 MAY 引用 gateRef；未通过 gate 的 Run MUST fail-closed。

#### Scenario: Approval gate blocks side effect

- **WHEN** 节点 gateRef 要求 draft 审批且用户未批准
- **THEN** Workflow MUST 暂停于该节点
- **AND** MUST NOT 将写操作记为 completed 证据

#### Scenario: Smoke gate fails workflow

- **WHEN** Team 启动前 smoke fixture 断言失败
- **THEN** Team Run MUST NOT 进入 MODEL 阶段
- **AND** 返回可读 gate 失败原因

### Requirement: Version lock and compatibility import

安装 Agent/Team Package 时系统 MUST 持久化 contentHash、installedVersion 与 sourceProvenance；启动 Run MUST 冻结 package version snapshot；未知 `schemaVersion` 或 `protocolVersion` MUST fail-closed；兼容导入 MUST 支持 Cursor/Claude 等价 manifest 的 adapter 映射且不修改源文件。

#### Scenario: Snapshot frozen per run

- **WHEN** 用户基于 v1.2.0 Agent Package 启动 Team Run
- **AND** Hub 随后升级到 v1.3.0
- **THEN** 进行中的 Run MUST 继续使用 v1.2.0 snapshot
- **AND** 新 Run 使用 v1.3.0

#### Scenario: Unknown schema version rejected

- **WHEN** 导入 `schemaVersion=99` 的包
- **THEN** 系统 MUST 拒绝导入
- **AND** MUST NOT 以 best-effort 静默降级运行

#### Scenario: Cursor-compatible package adapts

- **WHEN** Builder 提交 Cursor 等价 agent manifest 且 adapter 可映射 persona 与 bindings
- **THEN** 系统 SHALL 生成 normalized agent.package.json 写入受管目录
- **AND** 原始 Builder 文件 MUST 保持不变
