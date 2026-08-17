# Proposal: perf-hygiene-refactor-closeout

## Why

重构分支收尾回顾指出若干性能与命名卫生项仍待落地：`useKnowMeIcons` 默认全 document 扫描、`workspace-init` 冷启动同步扫 notes 目录、流式 chunk 每 token 触发 Zustand、`workbenchAgentRunEvents` 无界增长，以及 `STICKY_*` 环境变量未迁移至 `KNOWME_*`。

## What Changes

### P0 — 启动与 DOM 扫描

- `useKnowMeIcons(dep, rootRef)` 仅对传入 surface 根节点 mount；无 root 时 no-op
- 更新 AppShell / Shelf / Hub / Run / Manage / TaskHome / Expert / DaemonComposePanel 调用面
- `workspace-init` 不再调用 `loadAllNotes()`，返回空 `notes` / `groups`

### P1 — 运行时性能与内存

- `store-session` 流式 chunk 用 rAF / ≤32ms 节流合并同一 assistant 的 text 更新；切换/结束 flush
- `workbenchAgentRunEvents` 改用 `createEvictingMap`（maxEntries≈64、ttl≈24h），Map 接口兼容

### P1 — 命名卫生

- `KNOWME_PROMPT_SPACE_DIR` / `KNOWME_WORKBENCH_ROOT` 优先，兼容回退 `STICKY_*` 一次
- 注释「便签兼容」→「notes 数据兼容（产品面已退役）」；`ui-icons` / `app-icon` 产品口吻微调

## Out of Scope

- 删除 notesCompat IPC 与大拆 notes 模块
- 无关产品功能与 UI 布局变更

## Success Criteria

- 冷启动不扫 notes 目录；图标 mount 不触达全 document
- 流式回复 set 频率显著降低且文本完整
- `npm test` / `npm run lint` / renderer 相关单测通过
