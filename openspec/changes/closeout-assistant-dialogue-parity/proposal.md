## Why

对话相对 `f6ad048` 的剩余缺口需一次性收口：应用到文件/产物卡未接线、流式观感仍薄、会话知识/历史头像偏简，以及多份 restore-* 验收未勾。

## What Changes

- 「应用到文件」菜单 + 内容源目标；替换走 `editor_patch` 产物确认
- 会话 `run.artifacts` 产物卡（接受/拒绝/打开）
- 流式 chunk 观感加强（CSS）
- 知识菜单纳入 providers；历史列表带头像标记
- 勾选并补齐相关 acceptance / surfaces 诚实状态

## Capabilities

### New Capabilities

- `assistant-apply-artifacts`: 助理对话应用到文件与产物卡

### Modified Capabilities

- `agent-chat-ux`: 流式观感与会话知识/历史呈现

## Impact

- assistant 渲染/store、FilesPane 预览目标、api 类型、CSS、既有 restore-* acceptance
