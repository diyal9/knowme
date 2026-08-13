## 1. Projection helpers

- [x] 1.1 在 `workbench-daemon-surface.js` 新增 `formatDaemonPurposeTitle` / `resolveDaemonPurposeTitleLocal`
- [x] 1.2 单测：长 intent+URL → 短标题；空 intent → 工作流名回退；格式含 `Daemon 阶段 ·`

## 2. Runtime UI

- [x] 2.1 `emptyRun` / draft 支持 `purposeTitle`；`beginDaemonRun` / `openDaemonTask` 调用 `ensureDaemonPurposeTitle`
- [x] 2.2 `renderDaemonRunner` + `syncRunTopbar` 展示 `Daemon 阶段 · {purposeTitle}`
- [x] 2.3 复用 `api.aiSuggestTitle`；失败静默回退；草稿缓存

## 3. Main-chain acceptance

- [x] 3.1 编写 `evidence/daemon-mainchain-check.js`：overview → launchContext → task/progress；API 失败即停写 JSON
- [x] 3.2 跑脚本并记录结果；确认 KnowMe 投影契约（不要求远端 Agent API 必通）

## 4. Gate

- [x] 4.1 `npm test` + `npm run lint`
- [x] 4.2 写 `evidence/dev-self-test.md` 与 `qa-plan.md`
