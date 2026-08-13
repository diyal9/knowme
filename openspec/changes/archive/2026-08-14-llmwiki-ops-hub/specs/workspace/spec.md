## ADDED Requirements

### Requirement: Knowledge surface prioritizes ordinary user tasks

The default knowledge workspace SHALL keep “我的知识”, “待我确认”, and “来源” as its primary navigation and SHALL make Query, Ingest, and Lint more visually prominent than directory statistics, recent documents, health diagnostics, or compatibility features.

#### Scenario: Open the knowledge home

- **WHEN** 用户从左侧“知识网”进入默认首页
- **THEN** 页面首先呈现查找知识、添加资料和检查问题
- **AND** 目录、最近更新、健康状态和待确认数量作为辅助信息呈现

#### Scenario: Use the surface in a narrow window

- **WHEN** 知识首页在窄窗口中显示
- **THEN** 三项主要操作仍保持可见和可操作
- **AND** 辅助区域改为纵向排列且不造成水平溢出

#### Scenario: Keep advanced compatibility out of primary navigation

- **WHEN** 用户浏览知识网主导航
- **THEN** 主导航只显示“我的知识”“待我确认”“来源”
- **AND** Fabric、织网、治理和远程检索兼容路由不作为一级入口出现
