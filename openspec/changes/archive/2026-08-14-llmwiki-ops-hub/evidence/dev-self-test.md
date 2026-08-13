# 开发自测报告

- 日期：2026-08-10
- Change：llmwiki-ops-hub
- 定向测试：**PASS**（24/24 knowledge + llmwiki 相关）
- npm test：**PASS**（1574/1574）
- npm run lint：**PASS**（lint + script-scope）
- OpenSpec strict：**PASS**（`npx openspec validate llmwiki-ops-hub --strict`）
- Electron 冒烟：**PASS**（5/5）
- harness gate：**PASS**（硬项全过；软项均为其他 change 的 advisory）
- 控制台错误：**0**
- 窄窗：**PASS**（510px，无水平溢出）
- 应用启动：**PASS**（Electron smoke 启动成功）

## 实现摘要

- 将 `renderKnowledgeStatusWorkspace` 恢复为 Query / Ingest / Lint 操作枢纽（`.knowledge-ops-home`）
- 首页移除 `#statusFabric`（织网/Fabric 不再出现在默认首页）
- 侧边栏提供「在 Obsidian 中打开」与「关系图谱交给 Obsidian」文案
- 查询结果继续显示真实 qmd / 本地检索状态

## 证据

- `llmwiki-ops-hub-electron-smoke.json`
- `screenshots/llmwiki-ops-hub-desktop.png`
- `screenshots/llmwiki-ops-hub-narrow.png`

## 备注

- 冒烟环境未安装 qmd，查询正确显示「本地检索」并命中资料。
- 首页无自建 Canvas 图谱；Obsidian 为专业图谱出口。
- Fabric / 治理 / 远程 RAG 深路由仍保留，未删除兼容代码。
