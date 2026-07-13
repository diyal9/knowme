# Design: prompt-studio-v0.2

## Electron 边界

| 边界 | 位置 | 本 Story 要求 | 不进入本 Story |
|------|------|---------------|----------------|
| 卡片数据模型 | `src/main.js` saveNote/load | 扩展 fields；迁移旧卡片默认值 | 换数据库/SQLite |
| 结构化编辑 UI | `src/note.html` | 分段表单 + 自由模式切换 | Monaco/CodeMirror 重型依赖 |
| 总览筛选 | `src/list.html`, IPC | category/okfTags 筛选 | 独立 SPA 路由 |
| 记忆面板 | 新 `src/memory.html` 或 settings 区块 | 读 `product-memory.js` | 云端同步 |
| OKF 双向 | `src/lib/product-knowledge.js`, `prompt-okf.js`（新） | 卡片↔Concept | 自动批量升格 |
| AI 分类建议 | `src/main.js` ipc `suggest-tags` | 可选调用现有 API | 微调/本地模型 |
| 产品叙事 | README, `note.html`, `list.html`, tray | Sticky-Notes 文案 | 官网重构 |

## 数据模型

### 卡片 `notes/*.json`（向后兼容）

```json
{
  "id": "n_...",
  "content": "拼接后的完整提示词正文",
  "project": "项目名",
  "version": "1.0",
  "parentNoteId": null,
  "category": "coding",
  "okfTags": ["review", "api"],
  "okfConceptId": "concepts/my-prompt.md",
  "sections": {
    "role": "...",
    "context": "...",
    "task": "...",
    "output": "...",
    "criteria": "..."
  },
  "editorMode": "structured",
  "favorite": false,
  "tags": [],
  "copyCount": 0,
  "promptGroup": "",
  "updatedAt": "..."
}
```

- 旧卡片无新字段时：`loadAllNotes` 补默认 `category: ''`, `sections: null`, `editorMode: 'free'`
- `content` 始终可从 `sections` 拼接生成，保证 AI/复制/搜索不变

### OKF Concept（收录时写入）

```yaml
---
type: Concept
title: <project 或用户输入>
description: <首行摘要>
tags: [<okfTags>]
source_note_id: n_xxx
prompt_version: "1.0"
timestamp: ...
---
```

路径：`%APPDATA%/sticky-notes/knowledge/concepts/<slug>.md`

### 记忆（沿用 `product-memory.js`）

- 打开卡片、复制、AI 生成、收录 OKF 时 `capture`
- 面板读 `working/recent.jsonl` + `patterns/registry.json`

## IPC 新增（草案）

| Channel | 方向 | 用途 |
|---------|------|------|
| `get-note-versions` | invoke | 同 parent 链版本列表 |
| `get-note-diff` | invoke | 两 id 文本 diff 行 |
| `promote-to-okf` | invoke | 卡片 → Concept |
| `instantiate-from-okf` | invoke | Concept → 卡片 |
| `suggest-classification` | invoke | AI 建议 category/tags |
| `memory-recent` | invoke | 记忆面板列表 |
| `open-memory-panel` | send | 打开记忆窗口 |

## UI 结构

```
托盘 / 热键
├── 提示词卡片 (note.html)     ← 结构化编辑 + AI 侧栏
├── 总览 (list.html)           ← 分类/标签筛选 + 版本组
├── 记忆 (memory.html)         ← 近期 + 跳转
└── 设置 (settings.html)       ← 知识库 OKF（已有）+ API
```

## 版本与 diff

- `new-version` 已有 IPC：扩展为写入 `parentNoteId`，复制 sections
- diff：主进程简单 LCS 或逐行对比，渲染为 HTML 注入 note 或轻量 modal

## 性能与迁移

- 启动时不对全库做重算；仅在打开卡片时拼接 sections→content
- OKF lint 仍在 export 前执行
- 单元测试：`notes-migrate`、`prompt-okf` roundtrip

## 发布

- `package.json` → `0.2.0`
- `build/release-notes.md` 更新亮点
- tag `v0.2.0` 走现有 Release workflow

## 风险

| 风险 | 缓解 |
|------|------|
| 结构化/自由双模式数据不一致 | 保存时统一生成 content；单测覆盖 |
| OKF 与卡片双写 | promote 单向明确；concept 存 source_note_id |
| AI 分类耗 API | 手动分类始终可用；无 Key 跳过 |
| scope 过大 | tasks 分 P0/P1；P1 失败不阻塞 story-done |
