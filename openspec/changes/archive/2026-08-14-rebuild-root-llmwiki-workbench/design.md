## Context

See `proposal.md` for the product motivation. 当前渲染层已经有两套可复用能力：`knowledgeBrowserHtml()` 提供目录/筛选树，`openKnowledgeEntry()` 与 `renderKnowledgeRawEditor()` 提供阅读和 raw 编辑；`knowledgeTopbarHtml()`、刷新、Lint、审核和 Obsidian 事件也已存在。新的工作台应组合这些能力，而不是新增一套文件读写协议。

## Goals / Non-Goals

**Goals:**

- 让根 LLMWiki 成为默认可视化工作面。
- 在同一页面保持树、阅读/编辑和上下文状态同步。
- 通过纯渲染元数据呈现来源、更新时间和编辑边界。
- 保持 Electron 渲染层不直接访问文件系统，所有读写继续经 preload IPC。

**Non-Goals:**

- 不改变 `knowledge-os` 的索引和查询算法。
- 不把 memory 伪装成已确认知识；本阶段只展示现有根 Wiki 索引中的 raw 与 concepts。
- 不把外部 provider、Fabric 或图谱作为三栏工作台的一级内容。

## Decisions

### 1. 以现有本地浏览工作区作为工作台内核

将默认 `status` 入口收敛到本地根 Wiki 工作台，保留 `renderLocalKnowledgeWorkspace()` 的目录和阅读逻辑。相比继续维护独立的状态首页，这能避免首页与浏览页产生两套视觉和交互模型。

### 2. 三栏使用单一状态源

- 左栏由 `knowledgeUi.entries`、`knowledgeUi.query`、`knowledgeUi.filter` 和 `knowledgeUi.selectedPath` 驱动。
- 中栏由 `#kosReader` 承载欢迎态、Markdown 阅读器或 raw 编辑器。
- 右栏根据 `knowledgeUi.selectedPath` 从已有 entry 元数据生成，不额外读取文件；正文仍由 `openKnowledgeEntry()` 通过 IPC 读取。

用户选择条目后，先更新左栏选中态，再读取中栏内容，右栏立即展示路径和元数据；读取失败只影响中栏，不破坏树状态。

### 3. 右栏只提供上下文和现有动作

右栏显示“来源、类型、编辑边界、更新时间、整理状态”，并复用现有入口执行检查、整理、审核和 Obsidian 操作。避免新增新的 AI 自动写入按钮或新的主进程契约。

### 4. 断点响应式而非 JS 尺寸计算

桌面端使用 `280px minmax(0, 1fr) 230px` 三栏；中等宽度隐藏或折叠右栏；窄窗口改为树 → 阅读器 → 上下文的纵向顺序。所有滚动限制在工作台列内，不使用窗口 resize 监听，避免 Electron 启动后布局抖动。

### 5. 状态入口兼容迁移

保留 `openKnowledgeOsPanel(undefined, 'status')`、三个主 Tab 和旧的深路由别名。默认 status 直接渲染工作台；旧的状态卡 DOM 不再作为默认入口渲染，但不删除相关服务和兼容代码。

## Electron / IPC 边界

```text
renderer workspace.js
  ├─ knowledgeOsList / existing list state
  ├─ knowledgeOsRead ── preload ── main ── knowledge-os
  └─ knowledgeOsSaveRaw ── preload ── main ── harness-safe write
```

渲染层只组合状态和 DOM；文件内容、hash 校验、原子保存和路径防护继续由现有主进程服务负责。

## Risks / Trade-offs

- [Risk] 默认入口变更可能影响旧的“状态首页”契约 → 更新知识首页契约和 smoke，保留旧路由别名。
- [Risk] 三栏在 760px 窗口过窄 → 使用断点折叠右栏，并保证中栏最小可读宽度。
- [Risk] 右栏信息与中栏元数据重复 → 右栏只保留来源、边界和操作，不复制正文标题与大统计。
- [Risk] 目录树加载大量条目影响首屏 → 继续使用现有索引结果和惰性 DOM，避免启动时额外扫描或读取全文。

## Migration Plan

1. 新增工作台渲染结构，先复用现有浏览/阅读/编辑事件。
2. 将默认 status 入口切换到工作台并更新契约测试。
3. 通过 Electron smoke 验证 raw 编辑、只读 concepts、搜索和窄窗口。
4. 若视觉验收不通过，可回滚默认入口渲染函数和工作台 CSS，不触碰用户数据或 IPC。
