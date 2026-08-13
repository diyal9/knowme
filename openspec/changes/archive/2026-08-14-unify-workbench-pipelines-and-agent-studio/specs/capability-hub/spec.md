## ADDED Requirements

### Requirement: Agent profile configuration entry

Capability Hub MUST 为已安装 Expert/Agent 提供 Profile 配置入口，并显示其可用 Skill、连接器、输入输出、权限、风险和版本。保存配置后 MUST 能从当前目标或流程上下文继续进入工作台。

#### Scenario: Open Agent profile

- **WHEN** 用户在能力 Hub 打开已安装 Agent
- **THEN** 详情抽屉提供进入 Profile 配置的入口，并展示真实治理信息

#### Scenario: Return to active goal

- **WHEN** 用户从工作台目标进入 Hub 修改 Agent Profile 并保存
- **THEN** Hub 返回原目标和流程上下文，不要求用户重新输入目标

### Requirement: Capability to workflow handoff

Capability Hub MUST 支持将已安装 Agent 或 Skill 添加到当前工作流草稿；未安装或未授权能力 MUST 进入安装/授权引导，而不是写入不可执行引用。

#### Scenario: Add capability to workflow

- **WHEN** 用户选择“加入当前工作流”
- **THEN** 工作台收到带有 capabilityId、版本和当前上下文的结构化引用

#### Scenario: Unavailable capability handoff

- **WHEN** 用户选择未安装或未授权能力
- **THEN** Hub 显示修复入口，并且不创建不可执行的工作流节点
