## Context

See proposal.md — Why。`ensureDaemonProcessFeedMount` 当前 `chatLog.prepend(feed)`，注释写明「聊天流顶部」。

## Goals / Non-Goals

**Goals**：过程块挂对话流末尾；日志区贴底；贴底滚动与 Agent chat 一致。

**Non-Goals**：不改 transcript 投影字段；不引入 column-reverse。

## Decisions

1. **appendChild 替代 prepend** — 与消息时间轴同向，最新活动贴近 Composer。
2. **paint 后滚动日志 body 与（若 stick）chatLog** — 轮询刷新时仍能看到最新行。

## Risks / Trade-offs

- [用户已上滚阅读旧日志时被强制贴底] → 仅在 `chatStickToBottom` / 日志区自身溢出时贴日志 body；chat 跟随沿用现有 stick 语义。

## Migration Plan

纯前端；回滚恢复 prepend 即可。
