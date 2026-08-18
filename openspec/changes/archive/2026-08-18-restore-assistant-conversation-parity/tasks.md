## 1. Domain

- [x] 1.1 快捷气泡压缩（会议总结等）纯函数 + 单测
- [x] 1.2 飞书意图澄清 prompt（未授权 / unknown）纯函数 + 单测
- [x] 1.3 发送占位：`stage_prepare` trace 种子

## 2. 渲染 / 发送

- [x] 2.1 `sendMessage`：压缩显示、完整 prompt、`displayPrompt`、飞书澄清
- [x] 2.2 气泡：用户短标题；助手时间线 + 友好文案 + 耗时
- [x] 2.3 流式事件归约保持；主进程首个 stage 后让出事件循环
- [x] 2.4 kernel invoke 回传 committed 正文；detach 前 flush；v2 seq 字符串/晚到事件仍能落字
- [x] 2.5 助手气泡 Markdown 排版（加粗/列表），不依赖 Vite 失效的 markdown-lite IIFE

## 3. 验证

- [x] 3.1 `assistant.spec.tsx` 覆盖会议总结短气泡与发送后执行进度
- [x] 3.2 `npm test` / `npm run lint` / `typecheck:renderer`；写 `evidence/dev-self-test.md`
