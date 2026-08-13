# 开发自测报告

- 日期：2026-08-10
- Change：refine-knowledge-home-workbench
- npm test：**FAIL**（1511/1522；失败项为既有 workbench-templates / office-assistant 契约，与本次知识首页改动无关；知识相关 16 项全 PASS）
- npm run lint：**PASS**
- OpenSpec strict：**PASS**（`npx openspec validate refine-knowledge-home-workbench --strict`）
- Electron smoke：**PASS** 6/6（`node openspec/changes/refine-knowledge-home-workbench/evidence/knowledge-home-workbench-electron-smoke.js`）
- Harness preflight：**PASS**
- Harness gate：**FAIL**（硬项 npm test 因上述既有失败阻塞）
- 手动冒烟：Electron smoke 覆盖桌面/510px 窄窗；搜索、次级动作、目录树、Obsidian 入口可见

## 变更摘要

- 移除 `llmwiki-ops-hub` 风格的 Hero + Query/Ingest/Lint 三卡操作台
- 首屏改为搜索框 + 紧凑工具条 + 真实目录树 + 侧栏小型状态
- 待确认改为 `待确认 · N` 芯片；资料空间异常时才显示警告条
- 检索状态文案改为「智能检索 / 本地检索」

## 证据

- `evidence/knowledge-home-workbench-electron-smoke.json`
- `evidence/screenshots/knowledge-desk-home-desktop.png`
- `evidence/screenshots/knowledge-desk-home-narrow.png`
