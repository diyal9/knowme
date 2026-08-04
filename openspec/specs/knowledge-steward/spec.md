# Spec: Knowledge Steward Role

## Purpose

第一个角色工作台：知识管家——整理本地 LLM Wiki、健康检查、升格 OKF；验证「角色 = 默认工具包 + 任务模板 + 产物」模式。

## Requirements

### Requirement: Steward role selectable

用户 MUST 能以知识管家角色开始任务（New Agent 选项、空状态入口或等价切换）。

#### Scenario: Start as steward

- **WHEN** 用户选择知识管家并新建任务
- **THEN** 新 Session/Run 的 `run.role` 为 `steward`，并加载管家空状态/模板

### Requirement: Default task templates

知识管家空状态 MUST 提供至少四种任务模板：整理 Wiki（ingest）、健康检查（lint）、升格 OKF（promote）、检索远程知识库（remote-rag）。

#### Scenario: Click lint template

- **WHEN** 用户点击「知识健康检查」模板
- **THEN** 设置 `run.goal` 为对应文案，并触发或引导执行 `wiki.lint`，结果以 `health_report` 产物（或等价列表）展示

#### Scenario: Click ingest template

- **WHEN** 用户点击「整理本地 Wiki」模板
- **THEN** 引导选择目录/文件或使用已绑定 Wiki 根执行 ingest，完成后面板可见新条目

#### Scenario: Click promote template

- **WHEN** 用户点击「升格 OKF」模板且存在可升格条目
- **THEN** 生成 draft `knowledge_proposal` 供审阅

#### Scenario: Click remote RAG template

- **WHEN** 用户点击「检索远程知识库」模板
- **THEN** 设置 `run.goal` 为「检索远程知识库」，并发起助手回合优先经 MCP RAG 工具检索
- **AND** MCP/工具不可用时给出可操作提示，不得编造命中结果

### Requirement: Steward empty session tab label

新建且无自定义标题/目标/消息的知识管家 Session，Tab 标签 MUST 显示「知识管家」。

#### Scenario: New steward tab label

- **GIVEN** 用户选择知识管家并新建空对话
- **WHEN** Session 尚无自定义 `title`、无 `run.goal`、无用户消息
- **THEN** Tab / `displayTitle` 显示「知识管家」
- **AND** MUST NOT 显示通用「新助手」

### Requirement: Steward default tools

知识管家角色下，默认可用工具 MUST 包括 `wiki.query`、`wiki.ingest`、`wiki.lint`、`okf.promote`。

#### Scenario: Tools available

- **WHEN** 当前 Run 角色为 steward
- **THEN** UI 或 Agent 路径可调用上述四工具（按钮、斜杠或自动 query），缺一不可用时须有明确不可用原因

### Requirement: End-to-end steward loop

系统 MUST 支持不依赖「打开笔记改正文」完成一次管家闭环。

#### Scenario: Ingest lint propose accept

- **WHEN** 用户依次 ingest → lint → promote → 接受提案
- **THEN** Wiki/OKF 磁盘状态与面板一致更新，且全程可在工作台内完成（设置页非必须）

### Requirement: Steward review via work surface

知识管家任务产生的 `knowledge_proposal` / `health_report` draft MUST 默认在右栏 Work Surface 完成接受/拒绝；左栏保留任务轨迹与摘要。

#### Scenario: Promote lands in review surface

- **WHEN** 用户走「升格 OKF」模板并生成 draft `knowledge_proposal`
- **THEN** 右栏进入 `review`，用户可在右栏接受后落盘

#### Scenario: Lint report in review surface

- **WHEN** 「知识健康检查」产出 `health_report` draft
- **THEN** 右栏可展示报告全文或结构化列表，并支持关闭回文档

### Requirement: Other roles deferred

本 Story MUST NOT 实现产品/研发/测试/运维/运营等其它角色的完整工具包；可在 UI 预留「更多角色即将推出」而不假装可用。

#### Scenario: No fake roles

- **WHEN** 用户查看角色列表
- **THEN** 仅 steward（及 general/默认）为可用；其它角色若展示则标记不可用或隐藏
