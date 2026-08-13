## Purpose

为 KnowMe 提供统一、可版本化且可追溯的专业管线与个人工作流资源，使固定方法和用户编排的方法共享同一套 Agent 能力与运行协议。

## ADDED Requirements

### Requirement: Workflow Package identity and provenance

系统 MUST 为每个 Workflow Package 保存唯一标识、来源类型、版本、作者、组成引用和来源追溯信息。来源类型 MUST 支持 official、team、personal 和 forked。

#### Scenario: List workflow sources

- **WHEN** 用户打开流程库
- **THEN** 系统显示流程来源、版本、维护者和可执行状态

#### Scenario: Preserve fork provenance

- **WHEN** 用户从官方流程复制并保存个人流程
- **THEN** 个人流程保存原流程标识和版本，不修改原流程

### Requirement: Workflow inputs and outputs

Workflow Package MUST 声明输入、输出、所需能力、权限、质量门禁和支持的执行后端。缺少必需输入或依赖时 MUST 阻止启动并指出原因。

#### Scenario: Missing required input

- **WHEN** 用户启动流程但未提供必需材料
- **THEN** 工作台显示缺失项并保持流程处于未启动状态

#### Scenario: Unsupported backend

- **WHEN** 当前环境不支持流程声明的执行后端
- **THEN** 工作台显示不可用原因并提供可用后端或其他流程入口

### Requirement: Workflow package version snapshot

系统 MUST 在启动时保存 Workflow Package、Agent、Skill 和 Graph 的版本或内容哈希快照，运行结果 MUST 能引用该快照。

#### Scenario: Reopen historical workflow

- **WHEN** 用户重新打开历史运行
- **THEN** 系统显示运行当时的流程和能力版本，而不是用当前目录覆盖历史事实

### Requirement: Workflow package lifecycle

系统 MUST 区分草稿、已发布、已归档和不可执行状态；官方流程不可由个人直接覆盖。

#### Scenario: Archive workflow

- **WHEN** 用户归档个人流程
- **THEN** 历史运行仍可查看，但新目标默认不再推荐该流程
