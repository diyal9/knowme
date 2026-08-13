# Test Report: rename-knowledge-menu-to-web

- 日期：2026-08-09
- 执行人：开发（developer agent）

## 自动化

| 命令 | 结果 | 说明 |
|---|---|---|
| `npm test` | **PASS** 1491/1491 | 含 `tests/knowledge-web-naming.test.js`（3）与更新后的 `agent-rail-quick-entry.test.js` |
| `npm run lint` | **PASS** | 无 error |
| `node .cursor/scripts/harness.js gate --json` | **PASS** | 硬门禁通过 |
| Electron 冒烟 | **PASS** 4/4 | `evidence/knowledge-web-electron-smoke.json` |

## 本 change 新增断言

- rail `#btnKnowledgeOs`：`title` / `aria-label` / `.rail-label` = 「知识网」
- `openDrawer(title || '知识网')`、定位语「KnowMe 懂你的知识网」「懂你的知识网 · AI 检索 · …」
- 个体词保留：`本地知识库`、`添加 AI 检索源`、`知识库已就绪` 等

## 既有失败豁免（与本 change 无关）

- 并行 workbench 重构可能引入 `pageerror: Identifier 'api' has already been declared` — 本次隔离 user-data-dir 冒烟**未复现**；未修改 workbench 文件。
- `workbench-templates.test.js` / Daemon catalog 相关失败 — 未在本轮全量测试中复现（1491/1491 全绿）；若 CI 环境存在并行债务，不阻塞本 change。

## 本 change 是否引入新失败 / 新报错

**否。** 全量测试 0 fail；冒烟过滤后 console error 0；未新增 pageerror。

## 截图

- `evidence/screenshots/knowledge-web-rail-open.png`
