# 开发自测报告

- 日期：2026-08-13
- Change：`add-workbench-dialogue-status-bar`
- npm test（相关）：PASS — `tests/workbench-templates.test.js` + `tests/expert-task-chat-workbench.test.js`（69/69）
- npm run lint: PASS
- 手动冒烟: 已重启 Electron
  - 通栏：`#agentDialogueStatusBar` 提到 `.main` 首行，`grid-column: 1 / -1` 贯通左右
  - 高度：固定 32px 单行（标题 · 副文 · 状态 · 返回）
  - 右栏隐藏重复 `.wb-expert-task-head` / `.wb-run-topbar`，左右内容区贴齐通栏下沿
- 备注：请验收专家协作 / 工作流 / Daemon 三条路径的贯通顶栏。
