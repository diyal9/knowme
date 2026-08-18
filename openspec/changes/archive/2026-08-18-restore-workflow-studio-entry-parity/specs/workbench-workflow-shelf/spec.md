## ADDED Requirements

### Requirement: Manage copy forks a personal package

管理工作流的复制 MUST 调用 fork，名称带「（我的版本）」，并刷新列表。MUST NOT 打开编排。

#### Scenario: Copy my workflow

- **WHEN** 用户点击管理工作流卡片的复制
- **THEN** 系统 fork 该 id，toast 提示已复制为我的流程

### Requirement: Shelf empty offers new workflow

货架无工作流时 MUST 提供「新建工作流」（进入编排，返回货架）。

#### Scenario: New from empty shelf

- **WHEN** 货架为空且用户点击新建工作流
- **THEN** 打开空白编排，返回目标为货架
