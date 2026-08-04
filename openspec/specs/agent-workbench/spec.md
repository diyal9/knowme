# Spec: Agent Workbench

## Purpose

在右侧提供用户侧「工作台」：上半为岗位配套的 Agent 助手，下半为多源工作事项（飞书等）。左侧保持 Agent 对话列。工作台 **不是** 仅指 agent-workbench 编排引擎 UI；动态编排将通过对话结构化提问实现（后续 Story）。

## Requirements

### Requirement: Workbench entry from Ribbon

Ribbon 按钮 `#btnRailAi` MUST 作为「工作台」入口；点击 MUST 切换 `mode-workbench`，且状态 MUST 持久化。入口图标 MUST 使用完整 Lucide 24 viewBox 的 `workbench`（layout-grid）图标。

#### Scenario: Toggle workbench on

- **WHEN** 用户点击 Ribbon 工作台按钮
- **THEN** `#appShell` 获得 `mode-workbench`，右侧显示工作台，左侧 Agent 对话列仍可见，按钮呈激活态

#### Scenario: Restore after restart

- **WHEN** 用户在工作台开启状态下重启应用
- **THEN** 工作台模式按持久化状态恢复

### Requirement: User workbench surface

工作台主体 MUST 分为上半 Agent 助手区与下半工作事项区。MUST NOT 将入口或顶栏命名为 AgentTeams。

#### Scenario: Stacked assistants and items

- **WHEN** 用户进入工作台模式
- **THEN** 上半为 Agent 助手，下半为工作事项区

### Requirement: Compact agent cards and detail drawer

上半 MUST 以简洁卡展示 Agent（标题 + 一行角色）；点击 MUST 在助手区内打开详情抽屉（完整描述等），MUST NOT 占用下半事项区。再点同一卡或关闭 MUST 收起抽屉。

#### Scenario: Open detail drawer

- **WHEN** 用户点击某助手简洁卡
- **THEN** 助手区内展开详情，下半工作事项区仍可见

#### Scenario: Refresh roster

- **WHEN** 用户点击刷新
- **THEN** 重新加载助手列表；若原选中仍存在则保持详情

### Requirement: Agent roster from external source

助手 MUST 从外部 workbench 项目（默认 `D:\workflows\workbench`，可经 `workbenchRoot` 覆盖）只读加载；卡片 MUST 展示标题与角色，详情 SHOULD 展示描述与节点标签。

#### Scenario: Render agent cards

- **WHEN** 工作台首次进入且外部目录可读
- **THEN** 助手区列出各 Agent

#### Scenario: Missing external directory

- **WHEN** 外部 workbench 目录不存在
- **THEN** 工作台不崩溃，提示未能加载

### Requirement: Work items area

下半工作事项区 MUST 存在；本期 MAY 为空态，提示飞书等来源后续接入。MUST NOT 在此区展示编排 DAG / 运行日志。

#### Scenario: Empty work items

- **WHEN** 尚无外部事项源
- **THEN** 下半显示「暂无事项」类空态，不展示假运行控件

### Requirement: Read-only surface

工作台 MUST NOT 写回外部 workbench 的 `workflow-spec/` 或修改外部文件。

#### Scenario: No external writes

- **WHEN** 用户浏览助手或刷新
- **THEN** 外部 workbench 目录不被修改

### Requirement: Deferred dynamic orchestration

客户端工作流 DAG 驱动编排 UI 已下线。后续 SHOULD 通过对话结构化提问选择操作实现动态编排；`workbench-model` 与相关 IPC MAY 保留供后续复用，但 MUST NOT 在当前 UI 暴露。
