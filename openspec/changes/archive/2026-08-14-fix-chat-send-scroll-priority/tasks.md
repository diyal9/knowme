## 1. 滚动状态机

- [x] 1.1 在 `workspace-agent.js` 增加 stick-to-bottom / 程序化滚动标记与 near-bottom 判定
- [x] 1.2 为 `#agentChatLog` 绑定 scroll 监听：用户离开底部解除 stick，回到近底恢复
- [x] 1.3 主题锚点跳转时解除 stick，避免随后被自动跟随拽走

## 2. 发送与重绘路径

- [x] 2.1 `runAI` 推入用户消息后 `pinChatToBottom` 并强制滚到最新
- [x] 2.2 `renderChat` / 流式 paint：仅 stick 时跟随；非 stick 时避免 innerHTML 把视口甩到顶部
- [x] 2.3 自测：发送强制到底、上滑不抢焦点、回底恢复跟随；`npm test` + `npm run lint`；写 `evidence/dev-self-test.md`
