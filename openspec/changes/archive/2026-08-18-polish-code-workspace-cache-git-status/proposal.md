## Why

管线审阅「代码工作区」每次点文件都走 `workspace/blob`，大文件往返慢；左侧文件树无 Git 色差；右侧预览一律纯文本 `<pre>`，Go / Markdown / TypeScript 等无法按类型阅读，审阅体验偏「原始 dump」。本 change 补上会话缓存、变更着色，以及**按扩展名分流的美观预览**。

## What Changes

- 代码工作区对 `workspace/tree` 与 `workspace/blob` 做**会话内客户端缓存**（刷新/关窗/换仓失效；blob LRU + 体积上限）。
- 文件树按任务 `/changes` 状态着色（新增绿 / 修改黄橙 / 删除红；含变更祖先目录弱提示）。
- **右侧预览按文件类型渲染**：
  - Markdown → 排版预览（标题/列表/代码块等，DOMPurify 消毒）
  - Go / TypeScript / JavaScript / JSON 等代码 → 语法高亮 + 等宽代码面
  - 未知文本 → 干净纯文本；二进制仍不可预览说明
- 预览区可带轻量语言标识（如 `Go` / `Markdown`），气质对齐工作台，不做 IDE 全套 chrome。

## 目标用户

在 KnowMe 管线审阅里浏览任务工作树、核对 Agent 改动的开发者 / 制作人。

## 验收标准

- 同一文件二次打开走缓存，体感更快。
- 有变更时树中文件名颜色可区分 added / modified / deleted。
- 打开 `.go` / `.md` / `.ts` 时右侧分别为代码高亮、Markdown 排版、TS 高亮，而非同一灰字 dump。
- 刷新清空缓存；无变更时树中性色；`npm test` / `lint` 通过。

## 非目标（Non-goals）

- 不做持久磁盘缓存、不改 Daemon `workspace/*` 协议。
- 不做行级 diff、Monaco/CodeMirror 编辑器、可编辑保存。
- 不追求全语言覆盖（优先 Go / Markdown / TypeScript / JS / JSON；其余优雅降级纯文本或通用高亮）。
- 不在变更 Tab 列表大改样式。

## Capabilities

### New Capabilities

- `daemon-code-workspace-cache`: 代码工作区 tree/blob 会话缓存与失效规则。
- `daemon-code-workspace-git-colors`: 文件树按任务变更状态的 Git 风格着色。
- `daemon-code-workspace-typed-preview`: 按文件类型美观预览（Markdown 排版 + 代码语法高亮）。

### Modified Capabilities

- （无）

## Impact

- `src/workbench.js`（load/render blob、tree status class）
- `src/workbench-layout.css`（状态色 + 预览主题）
- `src/workspace.html`（按需引入 marked / purify；新 preview 模块）
- `src/lib/`：LRU 缓存、blob 预览渲染（扩展名 → kind、高亮/MD）
- 单测：缓存、状态映射、扩展名分流与渲染安全（XSS 转义/消毒）
