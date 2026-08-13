# Dev Self-Test · fabric-governance-and-conflict

## 日期

2026-08-08

## 命令

```bash
node --test tests/fabric-governance.test.js tests/fabric-knowledge-runtime.test.js tests/center-surface-tabs.test.js
npm run lint
node openspec/changes/fabric-governance-and-conflict/evidence/fabric-governance-electron-smoke.js
```

## 结果

| 项 | 结果 |
|---|---|
| fabric-governance 单测 | 10/10 PASS |
| fabric-knowledge-runtime | 8/8 PASS |
| center-surface-tabs | PASS（含治理 Tab） |
| lint | PASS |
| Electron 冒烟 | 见 `fabric-governance-electron-smoke.json` |

## 手动

- 知识中心 → 治理 → 运行体检 → 健康分/问题列表/SSOT 下拉
- 织网/检索 Tab 回归：按钮不卡死

## 已知

- 全量 `npm test` 有 5 个 workbench-templates 失败（仓库既有，非本 change）
