## Context

工作台一级导航为「任务 / 工作流 / 管线服务」。运行审阅与专家任务房是叠在其上的全屏层，退出应回到进入前的一级面。

当前缺陷：

1. `restoreTaskRoomReturnState` 无条件 `setSurface('shelf')`。
2. `captureTaskRoomReturnState` 把 `surface` 写死为 `'tasks'`，且不反映 `activeSurface` / `activeManagePanel`。
3. `openDaemonTask` 不写入 `taskRoomReturnState`。
4. Daemon 底栏 `handleRunAction('back')` 只 `resetRun()`，与顶栏 `backToRunList` 不一致。
5. `closeExpertTaskRoom` 一律回 `taskhome`，从货架打开的工作流对话房也会误回任务。

## Goals / Non-Goals

**Goals**

- 捕获并恢复一层来源：`taskhome` | `shelf` | `daemon`。
- 所有「离开运行/任务房」入口共用同一恢复函数。
- 契约测试锁定关键函数存在与返回映射。

**Non-Goals**

- 多级浏览器历史、跨会话持久化复杂栈（`returnState` 已可进 launchIntent，本 change 以内存 `taskRoomReturnState` 为主，并在 capture 时写入 intent）。

## Decisions

1. **来源枚举**  
   `resolveReturnSurface()`：若当前 `activeSurface === 'manage' && activeManagePanel === 'daemon'` → `daemon`；`shelf`/`studio` → `shelf`；其余 → `taskhome`。进入 run 前捕获。

2. **恢复**  
   `restoreTaskRoomReturnState`：  
   - `daemon` → `openManagePanel('daemon')`  
   - `shelf` / `workflows` → `setSurface('shelf')`  
   - 默认 / `taskhome` / `tasks` → `setSurface('taskhome')`

3. **Daemon 打开**  
   `openDaemonTask` 开头：`taskRoomReturnState = captureTaskRoomReturnState({ surface: resolveReturnSurface(), runId: slug })`；若调用方已在 daemon 面， naturally 记为 `daemon`。

4. **统一 back**  
   `handleRunAction('back')` → `backToRunList()`（内部已 `resetRun` + restore）。

5. **专家任务房**  
   `openExpertTaskRoom` 记录 `taskRoomReturnState`；`closeExpertTaskRoom` 调 `restoreTaskRoomReturnState` 而非写死 taskhome。若带 `workflow` 且来源未知，默认 `shelf`（货架对话）；纯专家任务默认 `taskhome`。

## Risks / Trade-offs

- 旧 launchIntent 里 `returnState.surface: 'tasks'` 会落到任务首页，比误进货架更合理。
- Studio 进入运行极少见；若从 studio 进 run，回来源记为 shelf（与 leaveStudio 一致）。

## Migration Plan

无需数据迁移。行为即时生效。
