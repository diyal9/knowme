# agent-profile Specification

## Purpose

定义可安装、可配置、可测试和可追溯的 Agent Profile，使 Skill、模型、连接器、权限和输出协议形成稳定 Agent 能力单元。

## Requirements

### Requirement: Agent profile configuration

Agent Profile MUST 支持配置角色职责、启用的 Skill、模型策略、连接器、记忆策略、输出协议、预算和并发限制。

#### Scenario: Configure an installed Agent

- **WHEN** 用户修改已安装 Agent 的配置并保存
- **THEN** 系统校验依赖和权限，并生成新的 Profile 版本

#### Scenario: Disable unavailable Skill

- **WHEN** Profile 引用未安装或未授权的 Skill
- **THEN** 系统标记 Profile 不可执行，并指出缺失 Skill

### Requirement: Agent profile trust and permissions

系统 MUST 在 Profile 保存和执行前校验 Agent、Skill、连接器的来源、权限和风险等级，不得因 UI 配置绕过能力治理。

#### Scenario: Permission escalation

- **WHEN** 用户配置的权限超过当前 Agent 或 Skill 允许范围
- **THEN** 系统拒绝保存或要求明确授权，不创建可执行 Run

### Requirement: Agent profile test run

系统 MUST 提供不产生生产副作用的 Profile 测试入口，并显示使用的 Skill、连接器、模型和输出校验结果。

#### Scenario: Test profile

- **WHEN** 用户对 Profile 发起测试
- **THEN** 系统使用隔离输入运行并展示能力调用和输出协议检查结果

### Requirement: Agent profile snapshot

Workflow 执行 MUST 保存 Agent Profile、Skill、连接器版本和权限摘要，后续运行不得静默替换这些引用。

#### Scenario: Profile changes after workflow creation

- **WHEN** 用户修改 Agent Profile 后重新打开旧工作流
- **THEN** 旧工作流显示原 Profile 快照，并提示是否升级到新版本
