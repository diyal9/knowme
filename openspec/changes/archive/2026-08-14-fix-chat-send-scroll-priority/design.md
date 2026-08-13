## Context

`renderChat` 在重绘前用「距底部 < 96px」决定是否跟随；`runAI` 发送后直接 `renderChat()`，未强制 pin。流式 `paintStreamText` 已用 near-bottom 门闸，但发送瞬间若用户在上方，新消息不可见。见 proposal.md Why。

## Goals / Non-Goals

**Goals:**
- 发送路径强制 stick-to-bottom 并滚到最新
- 用户 scroll 离开底部时解除 stick；回到近底恢复
- 程序化滚动不误判为用户上滑

**Non-Goals:**
- 不做回底 FAB
- 不改主进程 / IPC

## Decisions

1. **stick 状态机**（渲染进程内存）  
   - `chatStickToBottom`：默认 true  
   - 发送 / 等价发送：`pinChatToBottom()` → stick=true + 强制滚底  
   - `scroll` 监听：非程序化时按 near-bottom（96px）更新 stick  
   - 流式与普通 `renderChat`：仅 stick 时滚底；非 stick 时尽量保留原 `scrollTop`（避免 innerHTML 重置到顶部）

2. **程序化滚动标记**  
   - `chatProgrammaticScroll` 短窗口 / 同步标志，避免 `scrollTop=` 触发 listener 误 unpin

3. **入口**  
   - 统一在 `runAI` 推入 user+assistant 后 pin（覆盖手动发送、快捷任务、建议 send）

**Alternatives considered:** 仅传 `force` 给下一次 `renderChat`（无 stick 状态）——流式中途用户上滑后无法稳定「取消跟随」，故采用 stick 状态机。

## Risks / Trade-offs

- [Risk] innerHTML 后保留 scrollTop 与内容高度变化不完全对齐 → Mitigation：仅非 stick 时保留；stick 路径强制 `scrollHeight`
- [Risk] 主题锚点跳转被 stick 覆盖 → Mitigation：锚点跳转前 unpin（`chatStickToBottom = false`）

## Migration Plan

无数据迁移；热更渲染脚本即可。
