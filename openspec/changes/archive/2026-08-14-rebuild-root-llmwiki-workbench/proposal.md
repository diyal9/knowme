## Why

当前“我的知识”仍然以状态首页和临时卡片为主，用户看不到一个真正可操作的 LLMWiki：资料树、文档阅读、Markdown 编辑和 AI 整理彼此分离。现在需要把个人根 LLMWiki 做成 KnowMe 的主要工作界面，让用户像使用一个本地 Wiki 一样管理资料，同时把 AI 能力放在当前条目的上下文中。

目标用户是希望把自己的文件夹变成第二大脑、但不想维护知识图谱的个人用户。体验价值是资料结构可见、内容可读、原始资料可编辑、AI 建议可评估；商业化价值是形成稳定的本地 LLMWiki 使用习惯，再为后续专业外挂知识库提供基础。

## What Changes

- 将“我的知识”默认入口改为根 LLMWiki 工作台，而不是状态仪表盘。
- 提供左侧真实目录树和条目筛选，展示 `raw/` 资料与 `concepts/` 已整理知识。
- 提供中间阅读/编辑区：raw 条目可编辑保存，已整理知识只读阅读。
- 提供右侧条目上下文区：来源、路径、类型、更新时间、可编辑边界、整理状态和相关操作。
- 无选中条目时展示简洁的根库欢迎状态和最近资料，不使用大段说明或空洞统计卡。
- 保留现有搜索、刷新、Lint、提案审核和 Obsidian 桥接，不新增 KnowMe 图谱画布。
- 本阶段只重构根 LLMWiki；多个外挂专业知识库继续通过现有“来源”入口使用。

## Capabilities

### New Capabilities

- `llmwiki-workbench`: 根 LLMWiki 的三栏可视化工作台，包括资料树、阅读/编辑区和条目上下文区。

### Modified Capabilities

- `knowledge-os`: 根 LLMWiki 条目在工作台中的可读、可编辑和来源状态呈现。
- `workspace`: 默认知识入口、条目选择、阅读编辑和响应式布局。

## Impact

- 渲染层：`src/workspace.js`、`src/workspace.html`
- 现有 IPC：复用 `knowledgeOsRead`、`knowledgeOsSaveRaw`、刷新、Lint、提案和 Obsidian 桥接，不新增主进程接口
- 测试：知识页面契约、键盘/ARIA、Electron smoke 与截图证据
- 数据：不迁移、不改写用户现有 LLMWiki 文件

## 验收标准

- 用户进入“我的知识”后立即看到 LLMWiki 工作台。
- 左侧可以浏览目录和条目，中间可以阅读或编辑，右侧可以查看当前条目上下文。
- raw 文件保存、未保存状态和过期内容保护继续有效。
- 默认界面不暴露 Fabric、anchor、authority、Query/Ingest/Lint 等内部术语。

## 非目标（Non-goals）

- 不实现 Obsidian 式双链或图谱画布。
- 不在本阶段重构多个外挂知识库的工作台。
- 不实现云同步、多人协作或富文本编辑器。
