## MODIFIED Requirements

### Requirement: Default task templates

知识管家空状态 MUST 提供至少四种任务模板：AI 整理 Wiki（ingest）、健康检查（lint）、审核整理提案（review）、检索远程知识库（remote-rag）。

#### Scenario: Click lint template

- **WHEN** 用户点击「知识健康检查」模板
- **THEN** 设置 `run.goal` 为对应文案，并触发或引导执行 `wiki.lint`
- **AND** 结果以 `health_report` 产物或等价可操作列表展示

#### Scenario: Click ingest template

- **WHEN** 用户点击「AI 整理本地 Wiki」模板
- **THEN** 引导选择全部、新增或指定主题的资料范围
- **AND** 创建可恢复的 AI 整理任务，不要求用户手动复制正文到不存在的面板

#### Scenario: Click review template

- **WHEN** 用户点击「审核整理提案」模板且存在待审核提案
- **THEN** 打开知识工作台的提案审核视图
- **AND** 用户可以查看来源、差异并接受或拒绝

#### Scenario: Click remote RAG template

- **WHEN** 用户点击「检索远程知识库」模板
- **THEN** 设置 `run.goal` 为「检索远程知识库」，并发起助手回合优先经 MCP RAG 工具检索
- **AND** MCP/工具不可用时给出可操作提示，不得编造命中结果

### Requirement: Steward default tools

知识管家角色下，默认可用工具 MUST 包括 `wiki.query`、`wiki.ingest`、`wiki.lint`、`okf.promote` 以及整理任务的列出、读取、提案和审核能力；缺一不可用时须有明确不可用原因。

#### Scenario: Tools available

- **WHEN** 当前 Run 角色为 steward
- **THEN** UI 或 Agent 路径可调用查询、吸收、体检、批量提案和审核能力
- **AND** 每个工具的结果都记录在当前任务轨迹中

#### Scenario: Tool unavailable

- **WHEN** 某知识工具未注册、授权目录不可用或任务服务不可用
- **THEN** Agent 明确说明缺失原因和下一步
- **AND** 不得伪造任务已执行或文件已写入

### Requirement: End-to-end steward loop

系统 MUST 支持不依赖「打开笔记改正文」完成一次管家闭环，并支持多条资料的 AI 整理、提案审核、写入和索引刷新。

#### Scenario: Ingest organize review accept

- **WHEN** 用户依次选择资料范围、启动 AI 整理、审核提案并接受部分结果
- **THEN** Wiki/OKF 磁盘状态、索引、体检结果和面板计数一致更新
- **AND** 被拒绝或未处理的提案不改变正式知识

#### Scenario: Resume steward task

- **WHEN** 用户在 AI 整理任务中关闭页面后重新打开知识管家
- **THEN** 可以恢复任务进度、失败项和待审核提案
- **AND** 重试不会重复生成或写入相同提案

### Requirement: Steward review via work surface

知识管家任务产生的 `knowledge_proposal` / `health_report` draft MUST 默认在右栏 Work Surface 或等价的知识工作台审核区完成接受/拒绝；左栏保留任务轨迹、来源和摘要。

#### Scenario: Promote lands in review surface

- **WHEN** 用户走「AI 整理 Wiki」或「升格 OKF」流程并生成 draft `knowledge_proposal`
- **THEN** 右栏进入提案审核视图
- **AND** 用户可查看来源差异、编辑建议后接受或拒绝

#### Scenario: Lint report in review surface

- **WHEN** 「知识健康检查」产出 `health_report` draft
- **THEN** 右栏展示报告全文或结构化列表
- **AND** 每个问题可定位来源或生成处理提案
