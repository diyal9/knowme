# 开发自测报告

- 日期：2026-08-16
- Change：restore-assistant-conversation-parity
- npm test: PASS（1564 pass / 51 skip）
- npm run lint: PASS
- npm run typecheck:renderer: PASS
- 手动冒烟: 需在热更会话点「会议总结」核对短气泡 + 执行进度（请本地 `npm start` 看一眼）
- npm test: PASS
- npm run lint: PASS
- npm run typecheck:renderer: PASS
- 手动冒烟: 主进程 IPC 变更需 `npm start` 后再发「你好」
- 备注：对齐 f6ad048 对话壳。跟进：kernel invoke 回传 `text`；助手正文走 `renderKnowledgeMarkdown`（Vite 下 markdown-lite IIFE 没有 `render`，会把 `**` 当纯文本）。
