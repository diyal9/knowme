## 1. Implementation

- [x] 1.1 `fabric-governance.js`：SSOT / 断锚 / stale / 联合体检 / 提案 / 重织队列
- [x] 1.2 `fabric-weave` 织网 SSOT + syncHash；`fabric-retrieval` 冲突回流
- [x] 1.3 `knowledge-os-ingest` SSOT 钩子（mark/block）
- [x] 1.4 IPC + preload：`fabric-governance-*`、`fabric-reweave-run`
- [x] 1.5 知识中心「治理」Tab UI + `runAsyncKnowledgeButton`
- [x] 1.6 单测 `tests/fabric-governance.test.js`
- [x] 1.7 Electron 冒烟 `evidence/fabric-governance-electron-smoke.js`
- [x] 1.8 OpenSpec 工件 + roadmap §8 回填

## 2. Verification

- [x] 2.1 `npm test`（fabric + center-surface 通过；workbench-templates 5 项为仓库既有失败）
- [x] 2.2 `npm run lint`
- [x] 2.3 `node .cursor/scripts/harness.js gate --json`
