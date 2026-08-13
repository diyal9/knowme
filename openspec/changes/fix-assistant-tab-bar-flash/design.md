## Context

助理与工作台共用 `#agentSessionTabs`，靠 `surfaceUi.agent` / `surfaceUi.workbench` 分面保存打开集合。`setSurfaceMode` 切换后调用异步 `activateSurfaceSession` → `activateSession`（含 IPC）；`renderSessionTabs` 原先只在 IPC 返回后执行，导致切换瞬间仍画出上一面的多签页。

渲染进程内同步 DOM 更新即可；不涉及主进程/IPC 契约变更。

## Goals / Non-Goals

**Goals:**

- surface 切换的同一同步调用栈内，先恢复目标面 `openSessionIds` 并 `renderSessionTabs`。
- 保持现有 `surfaceSwitchNonce` 竞态防护与按面隔离语义。

**Non-Goals:**

- 不为消闪而阻塞 UI 等待 `agentSessionGet`。
- 不引入虚拟 DOM / 双 Tab 栏隐藏技巧。

## Decisions

1. **同步先画 Tab，异步再灌内容**  
   在 `setSurfaceMode`（switched）与 `activateSurfaceSession` 首次 `await` 前，用 `surfaceUi[mode].openIds` 过滤现存 sessions 后立刻 `renderSessionTabs()`。  
   备选：切换时先 `innerHTML=''` — 会造成空白闪一下，体验更差，否决。

2. **逻辑落在渲染层**  
   Tab 状态本就在 `workspace-agent.js`；无需主进程参与。

## Risks / Trade-offs

- [Risk] 目标面 `activeId` 对应 Session 已删，短暂画出空/少 Tab 后异步新建 → 可接受；与现有 `activateSurfaceSession` 回退一致。  
- [Risk] 内容区仍可能短暂显示上一 Session transcript 直到 IPC 返回 → 本 change 只保证 Tab 栏；内容区若再报闪另开 Story。
