> **展示层主张已被取代（superseded by `rebuild-workbench-workflow-shelf`）**
> 目录语义仍然有效：`catalog.visibility` / `category` / `order` 继续被保留和使用，
> `internal` 与 `deprecated` 继续被关闭式过滤掉（现在还会记入货架诊断）。
> 被取代的是展示主张：不再有「首屏仅 primary + 高级工作流折叠区」。货架平铺全部
> 可上架工作流，用领域 / 来源 / 关键词筛选代替目录分层折叠。

## Why

Daemon 已将工作流目录整理为常用、高级、内部和废弃四类，但 KnowMe 丢弃了目录元数据并把所有可见项平铺展示，导致用户面对过多相近流程，增加选择成本。现在应与 Daemon WebUI 使用同一套目录语义，让日常入口保持轻量，同时保留高级能力的可发现性。

目标用户：通过 KnowMe 工作台发起研发、测试和交付流程的项目成员，尤其是不熟悉 Daemon 内部工作流标识的普通用户。

商业化与体验价值：统一两端的信息架构可以减少误选和支持成本，使体验档、常用流程与专业高级流程形成清晰层级，并避免 KnowMe 在 Daemon 目录演进后持续产生独立维护成本。

## What Changes

- 保留 Daemon `/api/workflows` 返回的 `catalog.visibility`、`category` 和 `order` 元数据。
- KnowMe 默认只直接展示 `primary` 常用工作流，并按 Daemon `catalog.order` 排序。
- `advanced` 工作流放入显式的“高级工作流”折叠区，不再与常用工作流同屏平铺。
- `internal`、`deprecated` 及非法目录元数据采用关闭式过滤，不进入用户可选目录。
- 本仓库注入 Daemon 的 `game-dev-delivery` 试验工作流改为 `deprecated`，暂时退出 Daemon 与 KnowMe 的可选目录，但保留既有任务和内部执行兼容。
- 缺少 `catalog` 的旧版 Daemon 响应继续按 `primary` 兼容，避免版本升级造成空目录。
- 更新工作流数量、搜索与测试，使统计和交互基于用户可见目录。

验收标准：
- 当前 Daemon 索引下，首屏仅直接显示 `primary` 工作流，高级项默认收起。
- 展开高级区后可看到 `advanced` 工作流，并可正常搜索、打开和启动。
- `internal` 与 `deprecated` 工作流不会出现在列表、搜索结果和数量统计中。
- “手机游戏研发交付”不会出现在 Daemon WebUI 或 KnowMe 工作流目录中。
- 没有 `catalog` 字段的旧响应仍可正常显示。

非目标（Non-goals）：
- 除同步本仓库注入项 `game-dev-delivery` 的目录可见性外，不修改 Daemon 原生工作流、鉴权和 WebUI。
- 不重做工作流启动弹窗、DAG 或任务运行页。
- 不在 KnowMe 内维护工作流名称白名单。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace`: 工作台工作流目录改为遵循 Daemon 的目录可见性、排序和常用/高级分层。

## Impact

- `src/lib/workbench-daemon-client.js`：保留并规范化目录元数据。
- `src/workbench.js`、`src/workspace.html`：目录过滤、分层、排序、数量与折叠交互。
- `tests/workbench-daemon-client.test.js`、`tests/workbench-templates.test.js`：目录契约与渲染回归。
- 不新增依赖，不改变现有 IPC 和 Daemon API 请求路径。
