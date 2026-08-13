## Purpose

为用户提供安全、可解释、可保存的 Agent 协作步骤编辑体验，使已安装 Agent 能通过简单拖拽组合成个人工作流或专业工作流的派生版本；Skill、MCP 和知识库作为 Agent 能力配置，不作为自由连线节点。

## ADDED Requirements

### Requirement: Compose from approved capabilities

编排工作室 MUST 只允许使用已安装、已授权且能解析为合法 Package 的 Agent 和 Skill；能力缺失时 MUST 阻止执行并提供修复入口。

#### Scenario: Add an installed Agent

- **WHEN** 用户从能力中心将 Agent 添加到 Graph
- **THEN** 工作室显示其 Profile、Skill、输入输出和权限摘要

### Requirement: Graph editing and validation

搭建 Agent 页面 MUST 支持通过拖拽或键盘等价操作添加、删除、复制和调整 Agent 节点，并以“接着执行 / 同时执行 / 执行前确认”配置关系。系统 MUST 在保存和执行前校验未知引用、环、悬空边、handoff、权限和治理限制。

#### Scenario: Reject invalid graph

- **WHEN** 用户编辑 Graph 产生环或未闭合 handoff
- **THEN** 系统显示具体节点问题并禁止保存为可执行版本

#### Scenario: Reorder Agent steps

- **WHEN** 用户拖动 Agent 节点改变顺序，或使用键盘上移/下移
- **THEN** 画布和草案同步更新，关系语义保持可见，并在重新加载后恢复

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

工作流 MUST 作为稳定用户路径展示本地 Agent 列表、可编辑协作步骤、节点关系、校验问题、测试运行、保存和复制动作；不得只依赖一次性确认弹窗或只读节点列表承载编辑。Daemon Agent MUST NOT 进入候选列表。

#### Scenario: Revise a generated graph

- **WHEN** 用户从目标生成 Graph 草案后选择继续编排
- **THEN** 页面保留目标和草案，允许选择节点编辑职责、提示词、Skill、知识库、权限、输入输出和连接关系，并在修改后重新校验

#### Scenario: Save and run from the workspace

- **WHEN** 用户在编排工作面保存有效 Graph 并选择运行
- **THEN** 系统保存个人 Workflow Package 快照，通过统一启动流程创建新的 rootRunId，并进入工作面任务详情

### Requirement: Workflow nodes reference managed Agents

节点设置 MUST 提供步骤名称、步骤目标、关系和只读 Agent 能力摘要。Skill、基础提示词、知识库、模型、连接器、权限、记忆、输出格式和预算 MUST 在智能体管理页维护。节点 MUST 保存 Agent Package、默认 Profile 及其哈希快照。

#### Scenario: Configure an Agent node

- **WHEN** 用户点击画布中的 Agent 节点
- **THEN** 右侧允许编辑该步骤目标并查看 Agent 能力摘要，同时提供进入智能体管理页的入口，不在工作流中静默修改 Agent

### Requirement: Daemon Agents are excluded from local composition

工作流编辑器 MUST 只接受 `origin: local` 且可由 Agent Package Runtime 解析的 Agent。`origin: daemon` 的固定 Agent 不得通过拖拽、键盘或恢复草案进入本地 DAG。

#### Scenario: Daemon catalog is online

- **WHEN** Daemon 返回固定 Agent catalog 且用户打开工作流
- **THEN** 候选列表仍只显示本地 Agent，Daemon Agent 仅在 Daemon 模式页可见

### Requirement: Composition artifacts are actionable

Agent Graph Run 产生的产物 MUST 使用可打开的结构化 artifactRef，并能作为后续运行输入；只有名称而无路径或 URL 的条目不得渲染为可点击产物。

#### Scenario: Reuse a Graph artifact

- **WHEN** Graph Run 完成并产生本地或远程产物
- **THEN** 用户可以打开产物，或选择“用于新运行”将该 artifactRef 传入统一启动流程
