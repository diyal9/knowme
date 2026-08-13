## ADDED Requirements

### Requirement: Workbench quick expert opens expert detail
工作台任务首页的快捷专家卡 MUST 打开该专家的详情（Capability Hub 深链，`surface=workbench` + `presentation=detail`），MUST NOT 直接打开「安排专家执行任务」任务编排弹窗，也 MUST NOT 跳入专家库整页目录。「+ 新建任务」按钮 MUST 继续打开任务编排弹窗。

#### Scenario: Click quick expert card
- **WHEN** 用户点击任务首页已绑定专家的快捷卡片
- **THEN** 系统 SHALL 以详情叠层（`presentation=detail`）打开 Capability Hub 并选中该专家详情
- **AND** 详情 SHALL 以 `surface=workbench` 渲染开工动作（底栏仅「开始对话」）
- **AND** MUST NOT 展示专家库目录页（搜索 / 精选 / 全部专家网格）
- **AND** MUST NOT 自动打开任务编排弹窗

#### Scenario: New task still uses composer
- **WHEN** 用户点击「+ 新建任务」
- **THEN** 系统 SHALL 打开「安排专家执行任务」弹窗
- **AND** 用户可选择专家、目标与知识库后创建并开始

### Requirement: Workbench quick expert cards match expert library
工作台「快捷任务」中已绑定专家的卡片 MUST 与专家库目录卡（hub-card）信息架构一致：头像、展示名、分类/来源副标、描述、状态徽章与版本；展示名 MUST 优先使用与专家库相同的中文/目录名，而不是原始 slug。

#### Scenario: Bound expert renders library-parity card
- **WHEN** 用户打开工作台任务首页且当前工作模式已绑定专家
- **THEN** 快捷任务区 SHALL 渲染与专家库同类卡片结构的专家卡
- **AND** 精选专家（如 office-partner）SHALL 显示目录中文名（如「办公伙伴」）与头像（若有预设）
