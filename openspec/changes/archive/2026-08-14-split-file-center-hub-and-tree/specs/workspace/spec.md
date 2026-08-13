## MODIFIED Requirements

### Requirement: Content source file tree

工作台侧栏 SHALL 根据 Source 配置以两层展示内容源：源中心（管理与切换）与当前源文件树；无源时 SHALL 给出可执行的配置引导。

#### Scenario: Active source opens the file tree layer
- **WHEN** 已配置至少一个 Source 且存在活跃源
- **THEN** 侧栏默认进入文件树层
- **AND** 首屏展示该源的文件树（或空树提示）
- **AND** MUST NOT 在文件树层常驻展示完整的源管理分区列表（代码仓库 / 网页资料 / 其他本地目录 / AI 生成长列表）

#### Scenario: Switcher returns to the source hub
- **WHEN** 用户在文件树层点击返回或「切换」
- **THEN** 侧栏进入源中心层
- **AND** 源中心展示个人知识库入口、代码仓库、网页资料、其他本地目录与 AI 生成分组

#### Scenario: Picking a source enters the file tree
- **WHEN** 用户在源中心选择一个内容源
- **THEN** 该源成为活跃源
- **AND** 侧栏切换到该源的文件树层

#### Scenario: Missing source shows setup guidance
- **WHEN** 无 Source 或无活跃源
- **THEN** 侧栏展示源中心
- **AND** SHALL 提示前往设置添加本地文件夹或 GitLab / GitHub 项目，或从已有分组中选择

## ADDED Requirements

### Requirement: File tree layer chrome stays compact
文件树层顶栏 MUST 提供「打开」与「切换」；源身份条 MUST 仅展示当前源名与类型短信息，MUST NOT 把完整绝对路径或用途说明当作侧栏正文，也 MUST NOT 在身份条内再放打开/切换按钮。

#### Scenario: Compact active-source strip
- **WHEN** 文件树层渲染活跃源
- **THEN** 顶栏显示「打开」与「切换」
- **AND** 身份条显示源显示名与简短类型信息
- **AND** 完整地址仅可作为悬停提示
- **AND** 顶栏不常驻展示添加源、折叠目录与更多文件操作图标

#### Scenario: Hub chrome keeps management actions
- **WHEN** 侧栏处于源中心层
- **THEN** 顶栏显示添加与管理内容源入口
- **AND** 「打开」「切换」隐藏
