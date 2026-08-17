## Context

基线：`f6ad048` `src/settings.html` 记忆 Tab 与 `workspace.js` `openKnowledgeOsPanel`。现行 React 已有 IPC（`memory-overview`、`knowledge-os-read` 等），缺 UI 接线。

## Goals / Non-Goals

- Goals: 设置记忆 Tab 分区与字段对齐；知识库可打开正文、lint、发起 steward 整理。
- Non-Goals: Studio/飞书 iframe；完整知识网治理画布。

## Decisions

- 个人资料仍走 `saveSettings`（`userProfile` / `userPrompt` / `industry`），不另开 IPC。
- 习惯审阅走已有 `memoryReviewPattern({ id, action, summary })`。
- 知识正文走 `knowledgeOsRead({ kind, path })`，结果放 Zustand，不在 renderer 读盘。
- 整理入口调用 `knowledgeStewardTaskCreate({ scope: { mode: 'changed' } })`，然后刷新 steward 列表。

## Risks

- `memoryOverview` 数据量大时记忆 Tab 卡顿 → 沿用服务端 slice(50)/recentLimit。
- 知识正文很长 → 只渲染纯文本 `<pre>`，不做 Markdown 全量解析。
