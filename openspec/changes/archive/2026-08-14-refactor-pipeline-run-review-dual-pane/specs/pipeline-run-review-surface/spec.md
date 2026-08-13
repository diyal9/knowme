## Purpose

管线任务执行间：左过程对话、右审阅制品，对齐 Daemon WebUI 语义。

## ADDED Requirements

### Requirement: 右栏审阅制品

管线（Daemon）任务进入执行间时，右侧主表面 SHALL 呈现「审阅」区域，包含 Tab：**步骤**、**制品**、**变更**、**事件**。默认推荐打开 **步骤**（可显示「推荐」标记）。制品 Tab 无文件时 MUST 显示「暂无制品」类空态，不得伪造条目。

#### Scenario: 打开管线执行间看到审阅 Tab

- **WHEN** 用户打开一条 Daemon 管线任务执行间
- **THEN** 右侧可见审阅标题与四个审阅 Tab
- **AND** 默认激活步骤或产品推荐的步骤 Tab

#### Scenario: 制品空态

- **WHEN** 任务尚无 artifacts
- **THEN** 制品列表显示暂无制品类提示
- **AND** 可见可导航到过程日志的动作

### Requirement: 左栏过程以对话内容展示

管线执行间左侧对话区 SHALL 展示来自 Daemon 的过程内容：至少包含 progress 摘要（progress.md 语义）与运行日志摘录；过程块以可读的过程/系统消息形式呈现，用户仍可在同一对话区补充要求。

#### Scenario: 有 progress 摘要

- **WHEN** Daemon `/progress` 返回非空文本
- **THEN** 左侧过程区展示该摘要（可折叠）

#### Scenario: progress 为空

- **WHEN** progress 为空或未生成
- **THEN** 显示「暂无 progress 摘要」类提示，不报错崩溃

#### Scenario: 运行中轮询刷新

- **WHEN** 任务未终态且工作台轮询刷新
- **THEN** 过程区与右侧状态随最新 progress/logs/task 更新
