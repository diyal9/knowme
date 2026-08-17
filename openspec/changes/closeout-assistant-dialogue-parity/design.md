## Context

便签编辑器已退役；基线「应用到文件」依赖 `hasActiveEditor`/`noteId`。React 助理无产物卡与 apply 菜单。

## Goals / Non-Goals

- Goals：内容源文件目标上的 insert/append/replace；产物卡；流式 CSS；知识 providers；历史头像；验收勾选。
- Non-Goals：恢复独立便签窗；独立 token IPC 通道（继续用 stream contextInfo）。

## Decisions

1. Apply 目标 = `assistantApplyTarget`（文件中心预览时写入）或仅有 activeSourceId 时提示先打开文件。
2. insert/append：`sourcesReadFile` + 拼接 + `sourcesWriteFile`；replace：`agentArtifactAdd(editor_patch)` 后产物卡确认。
3. 产物列表来自 active session `run.artifacts`，操作后刷新 session。
4. Token：保持 `assistantContextInfo`（surfaces 标诚实：非独立 IPC）。
5. 用户气泡保持左对齐（与 f6ad048 一致）。
