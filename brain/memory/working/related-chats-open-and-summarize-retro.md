# Retro: related-chats-open-and-summarize

## 做了什么

相关聊天可点跳转飞书；主题/建议替代原文 dump；统一消息轨道；修复结果正文 720px 内层宽度导致右侧留白。

## 学到什么

建立共享 `--agent-message-track` 后，专用结果区若再写 `min(100%, 720px)` 会与执行过程条错位。专用布局只应调 padding/字号，不应再收窄宽度。

## 后续

- 历史气泡需重新跑快捷操作才刷新宽度
