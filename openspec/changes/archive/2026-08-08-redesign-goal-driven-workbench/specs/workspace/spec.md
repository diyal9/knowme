## ADDED Requirements

### Requirement: Goal-driven workbench home

工作台默认入口 MUST 以用户目标为第一交互，不得要求用户先选择工作模式；首页 MUST 提供目标输入、常用目标起点和继续工作的入口。

#### Scenario: User opens the workbench

- **WHEN** 用户打开工作台
- **THEN** 头部显示“开始 / 任务 / 团队”三个用户语言页面入口
- **AND** 首页首屏显示“今天想完成什么？”目标输入
- **AND** 首页不要求用户先选择“日常办公 / 软件研发 / 视觉创作”

#### Scenario: User submits a goal

- **WHEN** 用户输入非空目标并点击开始
- **THEN** 系统 MUST 使用该目标进入既有任务或工作流启动路径
- **AND** MUST 保留目标文本供后续任务上下文使用
- **AND** 不得因当前模式没有匹配工作流而显示空白失败页

#### Scenario: User uses a common starting point

- **WHEN** 用户点击“整理会议”“写一份方案”“开发一个功能”或“制作宣传图”等常用起点
- **THEN** 系统 MUST 将该起点转为可编辑目标
- **AND** 用户可以在开始执行前修改目标

### Requirement: Advanced workflow access is secondary

工作流目录 MUST 作为开始页中的次级模板入口保留；普通用户不需要理解工作流术语即可启动任务，专业用户仍可搜索、筛选和打开已有工作流。

#### Scenario: User opens all templates

- **WHEN** 用户从开始页点击“浏览全部模板”
- **THEN** 系统打开现有工作流目录
- **AND** 目录继续支持搜索、常用/高级分层和既有启动协议

#### Scenario: User uses a template without selecting a mode

- **WHEN** 用户从常用起点或全部模板选择一个模板
- **THEN** 系统 MUST 直接打开该模板的现有启动预览
- **AND** 用户不需要先切换工作模式

### Requirement: Tasks are the primary recovery surface

任务页面 MUST 聚合进行中、排队中、失败和历史任务，并为失败任务提供明确的详情入口；任务页面不得依赖用户当前工作模式才能显示历史。

#### Scenario: User reviews task history

- **WHEN** 用户进入“任务”页面
- **THEN** 页面显示可继续的任务、失败任务和最近历史
- **AND** 跨模式任务保留并显示来源信息

#### Scenario: User opens a failed task

- **WHEN** 用户点击失败任务
- **THEN** 页面打开既有任务详情或任务工作间
- **AND** 失败任务入口显示“查看详情”或等价的用户语言

### Requirement: Work mode remains an advanced filter

系统 MUST 保留已有工作模式、Agent 绑定和工作流元数据兼容；工作模式只用于推荐、排序或高级筛选，不得成为普通目标入口的硬性前置条件。

#### Scenario: Existing mode state is restored

- **WHEN** 用户重启 KnowMe
- **THEN** 已保存的模式和团队绑定仍可恢复
- **AND** 首页仍直接展示目标输入，不要求用户确认恢复的模式

#### Scenario: Workflow metadata is missing

- **WHEN** 目标起点或工作流缺少工作模式元数据
- **THEN** 用户仍可以从首页启动该入口
- **AND** 系统不得因缺少模式元数据而将目标入口渲染为空
