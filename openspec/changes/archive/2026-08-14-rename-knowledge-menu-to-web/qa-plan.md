# QA Plan: rename-knowledge-menu-to-web

## Smoke Scope（必填）

- [x] 应用启动 `npm start` 无崩溃（既有 pageerror 除外，见 test-report）
- [x] 左侧 rail `#btnKnowledgeOs` 显示「知识网」
- [x] 点击「知识网」打开知识中心，顶层标题为「知识网」
- [x] welcome / status 页个体库文案仍为「本地知识库」等

## Regression Scope

- [ ] 知识中心各 tab（状态、检索、织网、治理、整理、连接）可切换
- [ ] 设置 rail 入口未受影响
- [ ] Agent 聊天空态「查文档/知识库」未变

## Anti-pattern Checks（测试专用）

- [ ] 快速连点 rail「知识网」开关 drawer 无异常
- [ ] 打开知识中心后关闭再打开，标题仍为「知识网」

## 环境

- OS: Windows 10+
- 命令: `node openspec/changes/rename-knowledge-menu-to-web/evidence/knowledge-web-electron-smoke.js`
