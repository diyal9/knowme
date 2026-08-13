## Context

See proposal.md — Why。现状：审阅「过程日志」Tab 用 `GET /logs` 全文 + 2s 轮询整块 `innerHTML` 重绘并强制 `scrollTop = scrollHeight`。Daemon 上游 `iter_daemon_log_sse` 从文件头回放再 tail，事件为 `data: <line>`，结束为 `event: done`。

## Goals / Non-Goals

**Goals**

- 布局：运行日志区占满审阅 body 剩余高度。
- 阅读：贴底跟随；上滚锁定。
- 传输：运行中 SSE 增量；缓存按 slug；轮询不拉全文。

**Non-Goals（设计层）**

- 不在渲染进程用带 token 的 EventSource URL。
- 不共享跨窗口的日志缓存。

## Decisions

1. **主进程拉 SSE，IPC 推行**  
   Bearer 鉴权只在主进程；`fetch` 流式读 `text/event-stream`，经 `workbench-daemon-log-event` 推给 workspace。  
   备选：渲染进程 EventSource + query token → 拒绝（token 进 URL）。

2. **首屏 `/logs` + SSE 跳过前 N 行**  
   上游 SSE 从 pos=0 回放；预载后设 `skipRemaining = lineCount`，避免重复。  
   备选：仅 SSE 不预载 → 首屏空白更久。

3. **进度仍可随任务轮询；日志不随轮询**  
   `loadDaemonReviewExtras` 在 stream 活跃时跳过 `workbenchDaemonLogs`。手动刷新仍可强制拉一次全文对齐。

4. **纯函数 SSE 解析 + 缓存模块可单测**  
   `workbench-daemon-log-sse.js` 解析；缓存合并/截断（沿用 MAX 200 行展示，缓存可略宽）。

## Risks / Trade-offs

- [SSE 断开] → 退避重连；失败则降级偶发 `/logs` 尾部对齐。  
- [文件截断重置] → skip 计数可能错位；手动刷新重置缓存。  
- [长连接无超时] → 仅用 AbortSignal；离开任务必 stop。

## Migration Plan

纯客户端；无需数据迁移。回滚：恢复轮询全文即可。
