## ADDED Requirements

### Requirement: Workbench is organized around the active work mode
工作台 MUST 以当前工作模式组织团队、专业能力、常用工作流和任务，而不是将 Daemon 专家目录直接等同于整个产品的专家团队。

#### Scenario: Overview explains the active mode
- **WHEN** 用户打开工作台总览
- **THEN** 首屏 SHALL 显示当前工作模式的名称、用途、专业能力和团队摘要
- **AND** SHALL 提供切换工作模式的明确入口

#### Scenario: Engineering keeps existing workflows
- **WHEN** 当前模式为软件研发且 Daemon 在线
- **THEN** 总览与工作流页 SHALL 展示现有 Daemon 工作流和任务
- **AND** 既有启动、恢复与任务工作间行为 MUST 保持可用

#### Scenario: Non-engineering mode does not inherit coding catalog
- **WHEN** 当前模式为日常办公或视觉创作
- **THEN** 工作台 MUST NOT 把编码工作流作为该模式的默认专业流程
- **AND** MAY 将其作为切换到软件研发模式后的能力展示

### Requirement: Workbench separates overview, team and workflows
工作台 SHALL 提供总览、团队和工作流三个同级分栏；自动化继续作为独立一级入口，任务运行时继续进入现有任务工作间。

#### Scenario: Overview prioritizes actionable work
- **WHEN** 用户进入总览
- **THEN** 页面 SHALL 优先展示当前模式、需要继续的任务、常用工作流和团队摘要
- **AND** 团队成员 MUST NOT 以无下一步的只读目录墙占据全部主要空间

#### Scenario: Team tab manages the current team
- **WHEN** 用户进入团队分栏
- **THEN** 页面 SHALL 显示当前模式的内置角色与用户添加 Agent
- **AND** SHALL 提供“添加 Agent”入口打开 Capability Hub 专家页

#### Scenario: Workflow tab remains the execution catalog
- **WHEN** 用户进入工作流分栏
- **THEN** 页面 SHALL 继续提供搜索、常用/高级目录、启动关系图和最近运行
- **AND** SHALL 依据当前工作模式过滤或解释专业流程

### Requirement: Workbench uses user-facing provider language
工作台 SHALL 以“本机工作服务”“专业执行服务”等用户语言表达运行可用性；底层 Daemon、local 或 image provider 可用于诊断，但不得成为理解工作模式的前提。

#### Scenario: Engineering provider is offline
- **WHEN** 软件研发模式所需 Daemon 不在线
- **THEN** 工作台 SHALL 说明专业执行服务暂不可用及可采取的动作
- **AND** MUST NOT 将整个工作台描述为只能浏览

#### Scenario: Provider details are available on demand
- **WHEN** 用户查看模式或任务的诊断详情
- **THEN** 系统 MAY 显示实际执行提供方与连接状态
- **AND** 普通总览 SHALL 保持岗位和结果导向文案
