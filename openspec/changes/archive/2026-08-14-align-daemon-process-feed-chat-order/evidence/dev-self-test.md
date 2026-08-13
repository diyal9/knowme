# Dev self-test: align-daemon-process-feed-chat-order

## Date

2026-08-12

## Checks

- [x] `ensureDaemonProcessFeedMount` 使用 `appendChild`，禁止 `prepend(feed)`
- [x] paint 后日志区 `scrollTop = scrollHeight`
- [x] chat stick 时对话区贴底
- [x] lint + workbench-templates 静态契约

## Notes

- 垂直顺序：当前工作/消息 → 过程块 → 输入框
- 需重启 Electron 后打开管线执行间目视确认
