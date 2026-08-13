## Context

工作台 task-room 与 `mode-agent` 并存：左栏对话 + 右栏流程。助理全宽页用 `width:min(980px, calc(100% - 64px)); align-self:center` 收紧阅读宽度，该规则在 task-room 左栏仍生效，叠加 `--agent-reading-track: 780px` 后两侧留白过大。见 proposal Why。

渲染层纯 CSS，不涉及主进程 / IPC。

## Goals / Non-Goals

**Goals:**
- task-room 下对话列内容铺满可用宽度。
- 助理无文档全宽页保持居中轨道。

**Non-Goals:**
- 不改右栏宽度公式、消息协议或 Composer 交互逻辑。

## Decisions

1. **用 workbench task-room 选择器覆盖居中轨道**  
   在 `workbench-layout.css` 对 `.agent-chat-log` / `.agent-col-foot` 设 `width:100%; align-self:stretch`，并抬高该作用域内的 `--agent-message-track` / `--agent-reading-track`（阅读轨贴近消息轨）。  
   备选：全局抬高 980→1200 — 会拉长助理全宽页行长，否决。

2. **阅读轨在 task-room 内与消息轨对齐**  
   左栏已被右栏压缩，无需再套第二层窄阅读轨。

## Risks / Trade-offs

- [Risk] 超宽显示器左栏很长行 → 消息轨仍设 `min(1080px, 100%)` 上限。  
- [Risk] 选择器优先级不足 → 使用与现有 task-room 同等或更高具体度。

## Migration Plan

纯样式；回滚删除覆盖规则即可。
