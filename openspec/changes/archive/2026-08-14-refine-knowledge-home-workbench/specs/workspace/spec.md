## MODIFIED Requirements

### Requirement: Knowledge surface prioritizes ordinary user tasks

默认知识工作面 MUST 保持“我的知识”“待我确认”“来源”三主导航。常态首页 MUST 使搜索框比目录统计、最近更新和兼容功能更醒目，并遵循温暖灰白、低边框、无渐变、无重阴影的现有设计语言。

#### Scenario: Open the knowledge home

- **WHEN** 用户从“知识网”进入默认首页
- **THEN** 首屏围绕搜索/提问，次级动作为紧凑工具条
- **AND** 目录树、最近更新、待确认与健康状态作为辅助信息纵向或侧栏呈现

#### Scenario: Use the surface in a narrow window

- **WHEN** 知识首页在窄窗口（约 510px）显示
- **THEN** 搜索框与次级动作仍可见且可操作
- **AND** 布局纵向堆叠且不产生水平溢出

#### Scenario: Keep advanced compatibility out of primary navigation

- **WHEN** 用户浏览知识网主导航
- **THEN** 主导航只显示“我的知识”“待我确认”“来源”
- **AND** Fabric、织网、治理和远程检索兼容路由不作为一级入口出现
