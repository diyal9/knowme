# QA Plan: refine-knowledge-home-workbench

## Smoke Scope（必填）

- [x] 知识首页以搜索框为视觉中心，无 Hero 大标题与 Query/Ingest/Lint 术语
- [x] 次级动作含中文标签：添加资料、检查问题、浏览全部、Obsidian
- [x] 搜索返回命中并可打开资料；降级时显示智能/本地检索说明
- [x] 待确认为简洁入口，非压迫性主横幅
- [x] 510px 窄窗无水平溢出
- [x] Electron 渲染进程无新增 console error / pageerror

## Regression Scope

- [x] “我的知识 / 待我确认 / 来源”三主导航不变
- [x] 空库首触引导、Fabric/治理深路由未删除
- [x] Obsidian 桥接与添加资料流程可用

## Anti-pattern Checks

- [x] 首屏不出现 SaaS 营销 Hero、渐变待办横幅或 358 级大数字主视觉
- [x] 无仅图标无标签的 Obsidian 入口
- [x] 不向普通用户暴露 Fabric、authority、Query/Ingest/Lint

## 环境

- OS: Windows 10
- 命令: `node openspec/changes/refine-knowledge-home-workbench/evidence/knowledge-home-workbench-electron-smoke.js`
