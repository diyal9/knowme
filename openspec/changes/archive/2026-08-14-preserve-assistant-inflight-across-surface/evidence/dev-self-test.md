# 开发自测报告

- 日期：2026-08-13
- Change：`preserve-assistant-inflight-across-surface`
- npm test: PASS
- npm run lint: PASS
- 手动冒烟: 待制作人验收（助理发送 → 切工作台 → 回助理，对话与回复应保留）
- 备注：根因是切面 `activateSession` 用磁盘覆盖内存流式气泡；已用 `inflightChatBySession` 保活，离屏流事件只更新消息对象不误 render。
