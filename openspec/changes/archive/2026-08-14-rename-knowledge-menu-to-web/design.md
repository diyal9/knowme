## Context

命名单一事实源：`openspec/initiatives/knowledge-fabric-runtime/roadmap.md` §1.5。

「知识网」= 顶层聚合 / 菜单 / 整体；「知识库 / llmwiki」= 个体单元。本 change 仅触及用户可见的顶层文案，不触及运行时模块与 AI 层。

## Goals / Non-Goals

**Goals:**

- 左侧 rail 入口与知识中心顶层标题/定位语统一为「知识网」。
- 保留所有个体库、AI 提示词、专有名词与代码标识不变。
- 用静态测试 + 冒烟锁定边界，防止过度改名。

**Non-Goals:**

- 不批量替换源码中的 `knowledge-os`、`fabric-*` 等标识。
- 不修改 `rail-foot` 工具栏 `aria-label="知识库与设置"`（指 foot 分组，非菜单入口本身；见 code-review）。
- 不修改 `renderKnowledgeStatusWorkspace` 中「知识库已就绪」（指当前个体库就绪状态）。

## Decisions

### 1. 仅改三处顶层用户文案簇

| 位置 | 改前 | 改后 | 理由 |
|---|---|---|---|
| `workspace.html` `#btnKnowledgeOs` | 知识库 | 知识网 | 左侧菜单入口 = 整体 |
| `workspace.js` `openKnowledgeOsPanel` drawer title | 知识库 | 知识网 | center surface 顶层标题 |
| `workspace.js` welcome kicker | Knowledge workspace | KnowMe 懂你的知识网 | 知识中心首页整体定位 |
| `workspace.js` Obsidian 边界 KnowMe span | 知识整理 · … | 懂你的知识网 · … | 产品 vs Obsidian 整体分工 |
| `workspace.js` 打开 toast | 知识库已打开 | 知识网已打开 | 打开整体能力反馈 |

### 2. 明确保留（不改）

- `knowledgeTopbarHtml` 中 `active.displayName || '本地知识库'` — 个体库名。
- `renderKnowledgeStatusWorkspace` `<h1>知识库已就绪</h1>` — 个体库状态。
- `openKnowledgeOsPanel` 内错误文案「知识库加载失败」「知识库 API 不可用」— 指当前库实例。
- 连接页「选择当前对话和检索使用的知识库」— 个体源选择。
- 所有 `feishu-*`、`ai-assistant-context.js` 等 AI 层文件。

### 3. 测试策略

- 新增 `tests/knowledge-web-naming.test.js`：断言 rail「知识网」+ 顶层定位语 + 个体词保留。
- 更新 `agent-rail-quick-entry.test.js` rail 标签期望。
- Electron 冒烟：点击 `#btnKnowledgeOs`，断言 rail 标签与 drawer 打开，过滤既有 pageerror。

## Risks / Trade-offs

- **过度改名风险** → 静态测试显式断言「本地知识库」「添加知识库」仍存在。
- **并行 workbench pageerror** → 冒烟与 test-report 标注既有债务，不纳入本 change 阻塞项。

## UI 影响

- 用户可见：左侧 foot 按钮标签、知识中心打开后顶层标题与首页 kicker、Obsidian 交接页 KnowMe 描述、打开 toast。
- 无布局/CSS/IPC 变更。
