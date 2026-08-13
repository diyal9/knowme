# 开发自测报告

- 日期：2026-08-06
- Change：fix-chat-send-scroll-priority
- npm test: PASS
- npm run lint: PASS
- openspec validate --strict: PASS
- 手动冒烟: PASS（代码路径复核）
- 备注：
  - `runAI` 发送后 `pinChatToBottom()` 强制滚到最新
  - `#agentChatLog` scroll 监听：离开近底解除 stick，回近底恢复
  - 流式 `scrollChatToBottomIfNeeded` 尊重 stick；非 stick 全量重绘保留 `scrollTop`
  - 主题锚点跳转先 `chatStickToBottom = false`
