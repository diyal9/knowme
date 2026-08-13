# Test Report: llmwiki-ops-hub

- 日期：2026-08-10
- 执行人：developer agent

## 结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 单元/集成 | `npm test` | **PASS** 1574/1574 |
| Lint | `npm run lint` | **PASS** |
| OpenSpec | `npx openspec validate llmwiki-ops-hub --strict` | **PASS** |
| Electron 冒烟 | `node openspec/changes/llmwiki-ops-hub/evidence/llmwiki-ops-hub-electron-smoke.js` | **PASS** 5/5 |
| Harness gate | `node .cursor/scripts/harness.js gate --json` | **PASS** |

## Electron 冒烟明细

1. **llmwiki-three-action-hub** — Query / Ingest / Lint 三动作可见
2. **obsidian-is-graph-handoff** — Obsidian 入口存在，无自建图谱画布
3. **query-shows-actual-engine** — 显示「本地检索」，命中 ≥1
4. **narrow-layout-no-horizontal-overflow** — 510px 无水平溢出
5. **no-new-renderer-errors** — 控制台与 pageerror 均为 0

## 截图

- `screenshots/llmwiki-ops-hub-desktop.png`
- `screenshots/llmwiki-ops-hub-narrow.png`
- `llmwiki-ops-hub-electron-smoke.json`
