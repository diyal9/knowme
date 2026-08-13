# QA Plan: llmwiki-ops-hub

## Smoke Scope（必填）

- [x] 知识网默认首页优先展示 Query / Ingest / Lint 三项操作
- [x] Query 返回命中并显示真实的 qmd 或本地检索状态
- [x] 查询命中可打开对应资料
- [x] “在 Obsidian 中打开”作为可见次要入口，首页无自建图谱画布
- [x] 510px 窄窗无水平溢出，三项核心操作仍可用
- [x] Electron 渲染进程无新增 console error / pageerror

## Regression Scope

- [x] “我的知识 / 待我确认 / 来源”三主导航保持不变
- [x] 浏览资料、添加资料、检查问题仍复用原有流程
- [x] Fabric、治理与远程检索兼容路由未删除

## Anti-pattern Checks（测试专用）

- [x] 不用半成品图谱冒充专业关系视图
- [x] 不向普通用户显示 qmd 失败代码或 Fabric/authority 内部术语
- [x] qmd 不可用时不阻断查询，也不虚假声称 qmd 已执行

## 环境

- OS: Windows 10
- 命令: `node openspec/changes/llmwiki-ops-hub/evidence/llmwiki-ops-hub-electron-smoke.js`
