## Context

见 proposal.md — Why。渲染层 `setSurfaceMode` → `activateSurfaceSession` → `activateSession` 会 `agentSessionGet` 后整体替换 `chatHistory`。`runAI` 的 streaming 气泡只在内存，主进程通常只早落盘 user 消息；切面后流事件 `resolveAssistantRef` 找不到 `runId`，完成态也可能写到错误的 `activeSession`。

边界：仅渲染进程（`workspace-agent.js`）；主进程 IPC / Session schema 不变。

## Goals / Non-Goals

**Goals:**
- 进行中的 run 绑定一份可保活的 `chatHistory` 数组引用
- 流事件始终更新该引用，与当前 UI 是否在该 Session 无关
- 切回时恢复同一数组并 `renderChat`
- 完成态用 run 发起时的 `sessionId` 更新列表元数据

**Non-Goals:**
- 多 run 并行
- 切到其它 surface 时在后台继续绘制该对话 DOM
- 改主进程落盘时序

## Decisions

1. **保活 Map（sessionId → chatHistory 数组引用）**  
   启动 run 时登记；`activateSession` 若命中则复用该数组而非磁盘 hydrate；run `finally` 删除。  
   备选：切面时禁止切换 — 打断工作流，否决。

2. **`resolveAssistantRef` 先搜当前 `chatHistory`，再搜保活 Map**  
   保证离屏时流事件仍落到同一消息对象。

3. **完成态用 `runSessionId` 闭包，不用当时的 `activeSession`**  
   避免切面后把标题/messageCount 写到工作台 Session。

## Risks / Trade-offs

- [Risk] 保活数组与磁盘最终不一致 → Mitigation：完成后再 `agentSessionGet` 对齐；失败路径也释放保活  
- [Risk] 内存泄漏若 finally 未跑 → Mitigation：cancel / error / success 均走 finally  
- [Trade-off] 离屏时不增量 paint，切回才看到累计状态 — 可接受

## Migration Plan

纯前端热修，无数据迁移；回滚即移除保活分支。
