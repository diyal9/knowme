## Purpose

在工作流货架「你的工作流任务」区提供与「管理最近任务」同构的批量管理与删除能力，仅作用于带 workflowId 的任务。

## ADDED Requirements

### Requirement: Shelf recent header exposes manage entry

「你的工作流任务」标题行右侧 MUST 提供设置图标按钮，可达「管理工作流任务」弹窗。文案与无障碍标签 MUST 标明管理工作流任务（不得与「管理工作流」包入口混淆）。

#### Scenario: Open manage from shelf recent

- **WHEN** 用户在「工作流」Tab 点击「你的工作流任务」旁的设置图标
- **THEN** 打开管理弹窗，标题为「管理工作流任务」
- **AND** 列表仅包含 `workflowId` 非空的任务

#### Scenario: Empty workflow manage list

- **WHEN** 用户打开管理工作流任务弹窗且没有带 `workflowId` 的任务
- **THEN** 显示空态提示
- **AND** MUST NOT 列出无 `workflowId` 的专家任务

### Requirement: Workflow manage hub mirrors expert manage operations

管理工作流任务弹窗 MUST 提供与管理最近任务相同的操作面：勾选、全选、已完成、超过 1 个月、超过 3 个月、清空、删除所选；删除 MUST 使用既有任务归档能力，成功后刷新货架「工作流任务」列表与空态。

#### Scenario: Delete selected workflow tasks

- **WHEN** 用户勾选一条或多条工作流任务并点击「删除所选」
- **THEN** 被勾选任务从持久化最近任务中移除
- **AND** 「你的工作流任务」列表不再显示这些条目

#### Scenario: Selection strategies scoped to workflow tasks

- **WHEN** 用户在管理工作流任务弹窗点击「已完成」或「超过 3 个月」等策略
- **THEN** 仅对当前弹窗内的工作流任务应用勾选策略

### Requirement: Manage cards show workflow identity

管理工作流任务列表中的每张卡片 MUST 展示工作流名称（或 `workflowId` 兜底）与可辨识头像/图标标记；进度区 MUST 默认可折叠展开，行为对齐管理最近任务卡片。

#### Scenario: Card shows workflow name

- **WHEN** 用户打开非空的管理工作流任务弹窗
- **THEN** 每张卡片副文案可见工作流名与相对时间
- **AND** 可见进度 toggle（默认收起）
