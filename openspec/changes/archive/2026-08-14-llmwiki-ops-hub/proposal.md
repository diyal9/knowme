## Why

KnowMe 当前“我的知识”首页仍以目录和辅助状态为中心，用户需要自行理解多个入口后才能完成查找、添加与检查。现在需要把知识网收敛为面向普通用户的 LLM Wiki 操作枢纽，同时将专业关系图谱明确交给 Obsidian，避免重复建设低价值的图谱界面。

目标用户是不愿学习 Knowledge Fabric、索引与治理术语，但希望让本地资料可被 AI 稳定检索的个人用户和小型团队。体验价值是打开知识网即可完成 Query、Ingest、Lint；商业化价值是以可信、低门槛的本地知识闭环建立长期使用习惯，并为后续高级知识源和治理能力提供稳定入口。

## What Changes

- 将“我的知识”首页改为 Query（查找知识）、Ingest（添加资料）、Lint（检查问题）三项核心动作优先的 LLM Wiki 操作枢纽。
- 首页 Query 继续统一经过根 `llmwikiService`，优先使用 qmd；降级到本地检索时向用户显示可理解、真实的检索状态。
- 保留资料目录、最近更新、待确认数量和资料空间健康作为辅助信息，不再让它们压过核心动作。
- 将“在 Obsidian 中打开”提升为可见的次要入口，并明确关系图谱由 Obsidian 提供；KnowMe 不新增自建图谱画布或图谱数据服务。
- 默认导航继续收敛为“我的知识”“待我确认”“来源”，Fabric、织网和治理保持兼容但不进入普通用户主流程。

验收标准：
- 用户打开知识网后，无需理解内部架构即可直接查找知识、添加资料或检查问题。
- 首页查找返回标题、路径与摘要，可打开对应资料，并真实标明 qmd 或本地检索状态。
- 首页添加资料仍写入根 LLM Wiki `raw/`，检查问题仍复用统一 Lint 服务。
- 首页提供可见的 Obsidian 入口；应用未安装时沿用官方下载引导，已安装时可打开当前 Wiki。
- 默认用户界面不新增 Canvas 图谱，也不暴露 Fabric、authority、织网等内部术语。

非目标（Non-goals）：
- 不实现 Obsidian 式关系图谱、反向链接可视化或自有图布局引擎。
- 不删除 Fabric、治理、远程 RAG 或 Obsidian 桥接兼容代码。
- 不实现云同步、多人协作或富文本编辑。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `knowledge-os`: 将根 LLM Wiki 首页明确为 Query / Ingest / Lint 操作枢纽，并把 Obsidian 定义为专业关系图谱出口。
- `workspace`: 调整知识网默认工作面的信息架构、检索状态展示与响应式布局。

## Impact

- 界面：`src/workspace.js`、`src/workspace.html`。
- 服务：复用现有 `src/lib/llmwiki-service.js`、qmd 适配器与 Obsidian bridge，原则上不新增主进程能力。
- 测试：更新知识首页、命名与 Electron smoke 契约。
- 依赖：不新增第三方依赖，不迁移或删除用户知识数据。
