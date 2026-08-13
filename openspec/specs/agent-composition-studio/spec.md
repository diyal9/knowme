# agent-composition-studio Specification

## Purpose

为用户提供安全、可解释、可保存的 Agent Graph 编排工作面，使已安装 Agent 和 Skill 能组合为个人工作流或专业管线派生版本。

## Requirements

### Requirement: Compose from approved capabilities

编排工作室 MUST 只允许使用已安装、已授权且能解析为合法 Package 的 Agent 和 Skill；能力缺失时 MUST 阻止执行并提供修复入口。

#### Scenario: Add an installed Agent

- **WHEN** 用户从能力中心将 Agent 添加到 Graph
- **THEN** 工作室显示其 Profile、Skill、输入输出和权限摘要

### Requirement: Graph editing and validation

编排工作室 MUST 支持调整节点、输入输出、串并行关系和人工审批，并在保存和执行前校验未知引用、环、悬空边、handoff、权限和治理限制。

#### Scenario: Reject invalid graph

- **WHEN** 用户编辑 Graph 产生环或未闭合 handoff
- **THEN** 系统显示具体节点问题并禁止保存为可执行版本

### Requirement: Save and reuse composition

用户 MUST 能将通过校验的 Graph 保存为个人 Workflow Package，并能从已有流程复制后继续修改；保存内容 MUST 包含 Agent、Skill 和权限快照。

#### Scenario: Save personal workflow

- **WHEN** 用户确认一个有效 Graph 并保存
- **THEN** 系统创建个人工作流草稿，保留目标、Graph 和能力版本信息

### Requirement: Confirmation before run

动态 Graph MUST 在创建 Run 前显示节点、能力、输入、权限、执行后端和预期产物，并要求用户明确确认。

#### Scenario: Confirm graph

- **WHEN** 用户确认有效 Graph
- **THEN** 系统只启动确认版本对应的 Team Run 或指定执行后端

### Requirement: Fork official pipeline

用户 MUST 能从官方或团队专业管线创建个人派生版本，派生版本的修改不得影响源管线。

#### Scenario: Customize a professional pipeline

- **WHEN** 用户替换专业管线中的一个 Agent 并保存
- **THEN** 系统创建新的派生 Workflow Package，并显示源管线和版本关系

### Requirement: Dedicated composition workspace

编排工作室 MUST 作为稳定工作面展示 Graph 结构、节点检查器、校验问题、执行预览、保存和复制动作；不得只依赖一次性确认弹窗承载编辑。

#### Scenario: Revise a generated graph

- **WHEN** 用户从目标生成 Graph 草案后选择继续编排
- **THEN** 工作室保留目标和草案，允许选择节点查看职责、Profile、Skill、权限、输入输出和连接关系，并在修改后重新校验
