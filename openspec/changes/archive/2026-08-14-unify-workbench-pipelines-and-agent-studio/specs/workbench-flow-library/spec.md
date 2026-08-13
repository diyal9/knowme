## Purpose

让用户在同一个工作台流程库中发现、比较、复制、配置和启动专业固定管线与个人 Agent 工作流，并保持目标上下文连续。

## ADDED Requirements

### Requirement: Goal-aware flow discovery

流程库 MUST 支持从当前目标推荐专业管线、个人工作流和 Graph 编排入口，并显示推荐理由、输入输出和所需能力。

#### Scenario: Recommend flows from a goal

- **WHEN** 用户在工作台输入目标并打开流程库
- **THEN** 系统显示匹配的专业管线、个人工作流和能力缺口

### Requirement: Flow actions

每个流程 MUST 提供查看、使用、复制并自定义和查看历史运行等动作；不可执行流程 MUST 提供修复依赖或切换流程入口。

#### Scenario: Copy an official flow

- **WHEN** 用户选择复制专业管线
- **THEN** 系统创建个人草稿并打开编排或配置入口

#### Scenario: Repair unavailable flow

- **WHEN** 流程缺少 Skill、Agent、连接器或后端
- **THEN** 系统列出缺失项并提供安装、配置或改用其他流程的操作

### Requirement: Shared work context

流程库、能力中心、编排工作室和运行中心 MUST 传递同一个 goal、workflow、composition、run 和 artifact 上下文，跨页面返回时不得丢失。

#### Scenario: Return from Agent configuration

- **WHEN** 用户从某个目标进入 Agent 配置并保存
- **THEN** 系统返回原目标和原流程上下文，并允许继续编排

### Requirement: Flow source distinction

开始工作页 MUST 明确区分本地工作流与 Daemon 工作模式。Daemon 工作模式 MUST 跳转到独立 Daemon 模式页完成查看、启动和监控；不得把其固定 Agent 混入本地工作流编辑器。

#### Scenario: Display backend separately

- **WHEN** 用户查看一个由 Daemon 执行的专业管线
- **THEN** 系统将其显示为专业管线，并在执行信息中单独标注 Daemon 后端

### Requirement: Pipeline master-detail console

流程库 MUST 以可筛选列表和详情面板呈现，而不是同时维护另一套启动目录。列表 MUST 支持领域、来源、可用性和执行后端筛选；详情 MUST 显示输入、输出、Agent、步骤、质量门禁、readiness、最近运行和唯一主操作。

#### Scenario: Inspect before launch

- **WHEN** 用户在管线列表选择一个 Workflow Package
- **THEN** 详情面板显示该版本的执行信息和 readiness，且“查看”不会隐式启动运行

#### Scenario: Unavailable pipeline

- **WHEN** 选中管线存在依赖阻塞
- **THEN** 主启动操作禁用，详情面板列出修复依赖、安装能力或选择其他后端的真实动作

### Requirement: Unified resource workspace

管线与 Agent MUST 在同一个资源工作面中使用一致的列表—详情交互；资源详情只能有一个启动主操作，并将预选资源传给统一 Launch Controller。

#### Scenario: Switch resource type

- **WHEN** 用户在资源工作面从管线切换到 Agent
- **THEN** 领域和目标上下文保持不变，页面不重复渲染运行目录或启动表单

#### Scenario: Open historical runs

- **WHEN** 用户从资源详情查看运行记录
- **THEN** 系统进入工作面并应用该资源过滤条件，而不是只切换页面后丢失选择
