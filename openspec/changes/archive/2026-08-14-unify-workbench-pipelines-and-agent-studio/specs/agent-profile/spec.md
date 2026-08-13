## Purpose

为用户提供可安装、可配置、可测试和可追溯的 Agent 设置，使职责、提示词、Skill、知识来源、模型、连接器、权限和输出协议能够形成稳定的 Agent 能力单元。

## ADDED Requirements

### Requirement: Agent profile configuration

Agent Profile MUST 支持配置角色职责、行为提示词、启用的 Skill、知识来源与检索策略、模型策略、连接器、记忆策略、输出协议、预算和并发限制。主界面 MUST 使用可视化 Skill 与知识来源选择，不得要求普通用户填写内部 ID。

#### Scenario: Configure an installed Agent

- **WHEN** 用户修改已安装 Agent 的配置并保存
- **THEN** 系统校验依赖和权限，并生成新的 Profile 版本

#### Scenario: Configure prompt and knowledge

- **WHEN** 用户在节点设置中修改 Agent 的行为要求并选择知识来源
- **THEN** 系统保存提示词与知识策略，生成包含这些字段的 Profile 哈希和快照，并在测试运行中实际使用

#### Scenario: Disable unavailable Skill

- **WHEN** Profile 引用未安装或未授权的 Skill
- **THEN** 系统标记 Profile 不可执行，并指出缺失 Skill

### Requirement: Agent profile trust and permissions

系统 MUST 在 Profile 保存和执行前校验 Agent、Skill、连接器的来源、权限和风险等级，不得因 UI 配置绕过能力治理。

#### Scenario: Permission escalation

- **WHEN** 用户配置的权限超过当前 Agent 或 Skill 允许范围
- **THEN** 系统拒绝保存或要求明确的授权流程，不创建可执行 Run

### Requirement: Agent profile test run

系统 MUST 提供不产生生产副作用的 Profile 测试入口，并显示使用的 Skill、连接器、模型和输出校验结果。

#### Scenario: Test profile

- **WHEN** 用户对 Profile 发起测试
- **THEN** 系统使用隔离输入运行并展示能力调用和输出协议检查结果

### Requirement: Agent profile snapshot

Workflow 执行 MUST 保存 Agent Profile 版本、提示词、Skill 版本、知识来源与策略、连接器版本和权限摘要，后续运行不得静默替换这些引用。

#### Scenario: Profile changes after workflow creation

- **WHEN** 用户修改 Agent Profile 后重新打开旧工作流
- **THEN** 旧工作流显示原 Profile 快照，并提示是否升级到新版本

### Requirement: Workflow-scoped Agent profile

在工作流节点内修改 Agent 设置时，系统 MUST 默认创建或更新工作流级 Profile 副本，不得静默修改官方 Agent 或被其他工作流共享的 Profile。用户可明确选择将副本另存为“我的 Agent”。

#### Scenario: Edit a shared Agent in one workflow

- **WHEN** 用户在个人工作流中修改一个共享 Agent 的 Skill 或提示词
- **THEN** 只有该工作流节点引用的新 Profile 生效，其他工作流和历史 Run 保持原快照

### Requirement: Dedicated local Agent management

智能体管理页 MUST 允许用户编辑所有非 Daemon 的本地 Agent。基础信息、系统提示词、Skill 与连接器 MUST 保存到 Agent Package；知识来源、模型、权限、记忆、输出和预算 MUST 保存到默认 Agent Profile。

#### Scenario: Edit a local Agent

- **WHEN** 用户保存一个本地或本地安装的官方 Agent
- **THEN** 系统重新生成 Package/Profile 哈希，工作流候选立即显示最新摘要，历史工作流和 Run 仍保留原快照

#### Scenario: Inspect a Daemon Agent

- **WHEN** 用户从 Daemon 模式查看固定 Agent
- **THEN** 系统只显示来源、职责和状态，不提供 Agent Package 或 Profile 保存入口
