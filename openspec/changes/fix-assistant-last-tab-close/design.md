## Context

主进程 `agent-session-close-tab` 在打开集合为空时已 `createSession` 并返回 `{ ui, createdSessionId }`。渲染层 `closeSessionTab` 却在 `rest.length === 0` 时写回旧 `sessions`，随后还用旧集合 `agentSessionSetUi`，把主进程新建结果盖掉。

## Goals / Non-Goals

- Goals：关最后 Tab 落到新空白 Session；Tab 关闭钮与左缘对齐系统 chrome
- Non-Goals：改 Session 持久化模型、工作台 Tab、历史抽屉

## Decisions

1. **以 IPC 返回值为准**：`closeSessionTab` 先调 `agentSessionCloseTab`；若有 `createdSessionId`（或关完无剩余），用返回的 `ui.openSessionIds` / `activeSessionId` 写入 store，并 `hydrateSession`；**不再**用关前的旧 sessions 覆盖 `setUi`。
2. **多关清空**：`closeSessionTabs` 关完若空集，同样走「新建空白」路径（可复用单关逻辑或二次调 close / list）。
3. **样式**：`.agent-session-tab .tab-close` 对齐通用 `.tab-close`（16×16、常显于 active、hover 浅底直角圆角）；去掉 `opacity:0` 默认隐藏；Tab 条左 padding/margin 收紧贴齐 `.agent-col-head` 左缘。

## Risks / Trade-offs

- 乐观 UI 与 IPC 竞态：先 optimistic 再 IPC 易再踩覆盖；本修复改为 **IPC 成功后再 set**（关最后 Tab）/ 多 Tab 可先本地去掉再同步 ui。
- 关闭钮常显略增视觉噪音：规格已要求激活 Tab 显示 `×`，可接受。

## Migration Plan

无数据迁移。已打开的唯一脏 Tab 用户点一次 `×` 即可进入新空白 Session。
