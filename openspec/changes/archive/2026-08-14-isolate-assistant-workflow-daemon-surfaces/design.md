## Context

See proposal.md — Why。`#agentCol` / `chatLog` 由助理与工作台共用；`surfaceUi.v2` 已分 `agent` / `workbench` 两套 Tab，但 Daemon 过程投影是进程内 `daemonProcessCache`，`renderChat` 无条件 `restoreDaemonProcessFeedAfterChatRender`。`openAgentChat` 只关 `workbenchOn` 并 `setSurfaceMode('agent')`，不调用 `exitWorkbenchTask`，因此助理空态可与过程卡同屏。渲染进程本地状态，无主进程 IPC 变更。

## Goals / Non-Goals

**Goals:**

- 切到助理 surface 时过程投影与 task 上下文一并清除。
- 仅在工作台 surface 且存在有效 Daemon transcript 时绘制过程块。
- 归属启发式覆盖「工作台」后接间隔符变体，避免脏 Tab。
- 静态测试锁定关键守卫字符串与行为契约。

**Non-Goals:**

- 不拆第三套 DOM 对话列。
- 不改 Session 磁盘 schema / 主进程 API。
- 不重做对话房或审阅右栏。

## Decisions

1. **切面清缓存（首选）**  
   `setSurfaceMode('agent')` 时调用 `setDaemonProcessFeed(null)`；`openAgentChat` 额外 `setWorkbenchTaskView(false)`（或等价 `exitWorkbenchTask`）。  
   *备选*：仅 CSS 隐藏过程块 — 缓存仍在，`renderChat` 会再次画出，否决。

2. **恢复守卫**  
   `restoreDaemonProcessFeedAfterChatRender` / `paintDaemonProcessFeed`：若 `surfaceMode !== 'workbench'` 则强制清空并 return。  
   *备选*：只在 workbench 的 `syncDaemonProcessFeed` 侧防写 — 助理侧 `renderChat` 仍会 restore，不够。

3. **归属判定加宽**  
   `isWorkbenchOwnedSession`：在现有 `taskRef` /「工作台 ·」基础上，匹配 `/^工作台\s*[·\-—–]/` 与 `workflow-chat` / `expert-chat` 相关 taskRef（若元数据可得）。  
   *备选*：强制用户手动关 Tab — 体验差，否决。

4. **进程边界**  
   全部在渲染进程；不新增 IPC；不影响启动路径热路径以外的一次 surface 切换开销。

## Risks / Trade-offs

- [切回工作台 Daemon 运行间需重新 sync feed] → `workbench.js` 的 `syncDaemonProcessFeed` 在进入 daemon 布局时已有调用；验收时覆盖「助理 → 再进同一 Daemon」。  
- [过宽标题匹配误伤用户自命名] → 仅匹配「工作台」+ 间隔符前缀，不匹配正文含「工作台」的普通助理会话。  
- [异步 `activateSurfaceSession` 竞态短暂闪过程块] → 先清 feed 再 activate；`surfaceSwitchNonce` 已有。

## Migration Plan

1. 发版后无需数据迁移；首次切助理即自清。  
2. 启动时既有 `relocateWorkbenchSessionsFromAgentSurface` 继续跑，启发式加宽后二次清洗脏 Tab。  
3. 回滚：还原 `setSurfaceMode` / `openAgentChat` / restore 守卫即可。
