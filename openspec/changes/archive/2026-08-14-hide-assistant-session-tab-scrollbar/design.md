## Context

See proposal.md — Why. 助理顶栏 Session Tab 容器为 `.agent-tab-scroll`，当前 `overflow-x:auto` + `scrollbar-width:thin`，Electron/Chromium 会画出横向滚动条。同仓 `.drawer-surface-tabs` / `.wb-manage-tabs` 已采用隐藏滚动条模式。

## Goals / Non-Goals

- Goals：视觉上无滚动条；滚轮可横向浏览溢出 Tab
- Non-Goals：不改 Tab 数据模型；不新增导航按钮

## Decisions

1. **CSS 隐藏滚动条，保留 overflow**  
   - `scrollbar-width:none` + `::-webkit-scrollbar { display:none }`  
   - 与抽屉 Tab 一致，避免自定义滚动条组件

2. **在 `.agent-tab-scroll` 上把纵向滚轮映射为 `scrollLeft`**  
   - 仅当内容溢出且滚轮事件落在 Tab 条上时 `preventDefault`  
   - 优先使用 `deltaX`（触控板横向），否则用 `deltaY`  
   - 备选曾考虑仅靠 Shift+滚轮：不符合「滚轮即可」的验收，故不用

## Risks / Trade-offs

- [滚轮抢占] 用户在 Tab 条上想滚对话 → Mitigation：监听仅绑在 Tab 条，对话区不受影响  
- [触控板双轴] 同时有 deltaX/deltaY → Mitigation：取绝对值更大的轴

## Migration Plan

无数据迁移；热重载/重启即可。回滚：还原 CSS 与 wheel 监听。
