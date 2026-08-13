## Context

FAB 已是通知锚点（`refine-fab-as-notification-anchor`）。Daemon HITL 真值在 `refreshDaemonTask` / `daemonWaiting` / `run.hitlPending`。主进程无 Notification / focus 管道。见 proposal.md — Why。

## Goals / Non-Goals

**Goals:**

- 统一 attention payload：`{ id, kind, title, body, urgency, source, deepLink }`
- 前台：FAB 列表 + badge；`urgency:'input'` → 间歇铃铛；点开 FAB 停动画
- 后台：frameless 暗色 toast 窗；关闭或点击 → 聚焦工作台并可深链
- Daemon HITL 竖切边沿去重

**Non-Goals:** 完整通知中心；主进程 daemon 全量轮询；Session resume。

## Decisions

1. **渲染发事件，主进程只做出口**  
   HITL 检测仍在 workbench；主进程 `attention-notify` 根据 `workspaceWin` 可见/聚焦分流：聚焦 → `routed:'in-app'`；否则 show toast。

2. **桌面提示用自定义 toast 窗（对齐图 2）**  
   非系统 Notification（样式难控）。小窗：`alwaysOnTop`、`frame:false`、`skipTaskbar`、右下角。

3. **「不在焦点的任务栏」= 非当前 task-room 的该 run**  
   用户已在该 Daemon 工作间看 HITL 卡时：仍可写入 FAB 列表但不强制动画；离开后再需要动画。竖切简化：只要 `hitlPending` 且非「刚点开 FAB」就动画；打开 FAB 停动画。

4. **去重键** `daemon:{slug}:{gate|clarify}:{node}`  

## Risks / Trade-offs

- [hide 后 renderer timer 节流] → 竖切接受；后续可主进程 poll。  
- [多 HITL 并发] → FAB 列表堆叠，动画 OR 聚合。  
- [toast 被遮挡] → alwaysOnTop + 工作区右下角。

## Migration Plan

无数据迁移。回滚删 IPC/toast/FAB 订阅即可。
