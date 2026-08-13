## ADDED Requirements

### Requirement: Workbench workflow catalog follows Daemon visibility
当工作台从 Daemon 读取工作流目录时，系统 MUST 保留并遵循 Daemon 提供的目录可见性和排序语义。`primary` 工作流 MUST 作为常用入口直接展示，`advanced` 工作流 MUST 放入默认收起的高级区域；`internal`、`deprecated` 或显式非法的目录可见性 MUST NOT 出现在列表、搜索结果或可见数量统计中。

#### Scenario: Primary workflows are the default catalog
- **GIVEN** Daemon 返回同时包含 `primary` 和 `advanced` 工作流
- **WHEN** 用户打开工作台的工作流页
- **THEN** 页面直接展示按目录顺序排列的 `primary` 工作流
- **AND** `advanced` 工作流不与常用项同屏平铺

#### Scenario: Advanced workflows remain discoverable
- **GIVEN** Daemon 返回至少一个 `advanced` 工作流
- **WHEN** 用户展开“高级工作流”区域
- **THEN** 页面展示按目录顺序排列的高级工作流
- **AND** 用户可以搜索、打开并启动这些工作流

#### Scenario: Internal and deprecated workflows stay hidden
- **GIVEN** Daemon 响应中包含 `internal`、`deprecated` 或非法目录可见性的工作流
- **WHEN** 工作台构建工作流目录与数量统计
- **THEN** 这些工作流不会出现在目录、搜索结果或可见数量中

#### Scenario: Repository-injected game delivery workflow leaves the catalog
- **GIVEN** 本仓库向 Daemon 注册 `game-dev-delivery`
- **WHEN** KnowMe 同步该工作流的目录元数据
- **THEN** 注册项使用 `deprecated` 可见性
- **AND** “手机游戏研发交付”不会出现在 Daemon WebUI 或 KnowMe 的目录、搜索与可见数量中
- **AND** 已存在任务和内部按 ID 执行的兼容数据不被删除

#### Scenario: Legacy Daemon response remains compatible
- **GIVEN** 旧版 Daemon 返回的工作流没有 `catalog` 字段
- **WHEN** 工作台规范化该响应
- **THEN** 系统将该工作流作为 `primary` 目录项展示
- **AND** 工作流仍可正常打开和启动

#### Scenario: Daemon catalog order is stable
- **GIVEN** 同一可见性分组中的工作流带有不同 `catalog.order`
- **WHEN** 工作台渲染该分组
- **THEN** 数值更小的工作流排在前面
- **AND** 相同顺序值保持 Daemon 响应中的相对顺序
