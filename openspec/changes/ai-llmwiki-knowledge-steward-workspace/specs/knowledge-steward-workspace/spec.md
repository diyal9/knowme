## Purpose

为本地 LLM Wiki 提供以 AI 整理为主、用户审核为门禁的知识工作台，让原始资料能够持续生成可追溯、可复用的正式知识。

## ADDED Requirements

### Requirement: Knowledge workspace SHALL be action-oriented

知识库页面 MUST 默认展示当前 LLM Wiki 的处理状态、下一步操作和待审核数量；资料浏览、知识源配置和 Obsidian MUST 作为辅助入口。

#### Scenario: Bound wiki has not been analyzed

- **WHEN** 用户打开已绑定但尚未分析的 LLM Wiki
- **THEN** 页面展示资料总数、未分析状态和「开始 AI 整理」主操作
- **AND** 用户无需先浏览文件树即可启动整理任务

#### Scenario: Pending proposals exist

- **WHEN** LLM Wiki 存在待审核整理提案
- **THEN** 页面优先展示待审核数量和「查看待审核提案」操作
- **AND** 页面不得将资料浏览作为唯一下一步

### Requirement: User SHALL be able to start scoped AI organization

系统 MUST 支持用户选择全部资料、新增或变更资料、或指定主题/文件集合启动 AI 整理。

#### Scenario: Start incremental organization

- **WHEN** 用户选择「新增或变更资料」并启动整理
- **THEN** 系统创建可追踪任务并只分析符合范围的资料
- **AND** 页面显示任务状态和已处理数量

#### Scenario: Cancel organization

- **WHEN** 用户取消正在运行的整理任务
- **THEN** 系统停止继续生成新提案
- **AND** 已生成但未接受的提案保持可审核
- **AND** 原始资料和正式知识均不被修改

### Requirement: Organization task SHALL be resumable

批量整理任务 MUST 暴露扫描、分析、提案生成、失败、取消和完成状态，并支持失败项重试或从上次进度继续。

#### Scenario: Recover after transient failure

- **WHEN** 某批次模型调用失败但任务仍有未处理资料
- **THEN** 页面显示失败项和可重试操作
- **AND** 重试不得重复写入已存在的提案

#### Scenario: Reopen workspace during task

- **WHEN** 用户关闭并重新打开知识库页面
- **THEN** 页面可以恢复显示最近任务状态、进度和待审核提案

### Requirement: Proposals SHALL be traceable and reviewable

每条 AI 整理提案 MUST 包含来源路径、来源版本标识、目标分类、建议内容、变更摘要和审核状态；用户 MUST 能查看来源和差异后再决定。

#### Scenario: Review organization proposal

- **WHEN** 用户打开一条整理提案
- **THEN** 页面展示来源条目、建议目标、变更前后内容和 AI 理由
- **AND** 用户可以接受、编辑后接受、拒绝或稍后处理

#### Scenario: Source changed before review

- **WHEN** 提案来源在生成后发生变化
- **THEN** 页面标记该提案存在来源冲突
- **AND** 系统禁止静默接受旧提案覆盖新来源

### Requirement: Accepted proposals SHALL update the knowledge index

系统 MUST 仅在用户接受提案后写入正式知识层，并在成功后刷新索引、执行基础体检并更新页面计数。

#### Scenario: Accept proposal

- **WHEN** 用户接受一条无来源冲突的提案
- **THEN** 系统原子写入目标知识文件
- **AND** 刷新知识索引并重新检查目标文件
- **AND** 页面将提案标记为已接受

#### Scenario: Reject proposal

- **WHEN** 用户拒绝一条提案
- **THEN** 提案标记为已拒绝
- **AND** 原始资料和正式知识文件均不得发生变化

### Requirement: Health issues SHALL be actionable

知识体检结果 MUST 支持定位来源条目，并能基于问题上下文生成整理或修复提案。

#### Scenario: Open lint issue

- **WHEN** 用户点击重复标题、断链或空文件问题
- **THEN** 页面打开对应条目并展示问题位置或来源路径
- **AND** 提供「让 AI 生成处理方案」操作

#### Scenario: No health issues

- **WHEN** 体检未发现问题
- **THEN** 页面展示健康通过状态、扫描数量和最近检查时间
- **AND** 提供继续整理或返回资料浏览的入口
