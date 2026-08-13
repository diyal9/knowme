## 1. Extract temporal anchor

- [x] 1.1 新增 `src/lib/temporal-anchor.js`，导出 `buildTemporalAnchorContext`
- [x] 1.2 `src/ipc/ai-generate.js` require 并调用该导出
- [x] 1.3 删除 `src/main.js` 中未使用的同名局部函数

## 2. Horizontal IPC closure leaks

- [x] 2.1 `ai-generate` deps 补齐：`loadSourcesStore` / `getActiveSourceRoot` / `kosSourcesCtx` / `workbenchDaemon` / `buildActiveSourceFileTools` / `agentRuntimeOutputBridges`
- [x] 2.2 `main.js` `registerCoreIpc` 传入缺失项；`mergeExtraTools` 抽到 lib
- [x] 2.3 `ai-assist` 取消路径本地 require + 真实 `cancelAllSubRuns`

## 3. Anti-pattern hardening (Round 1 BLOCKING)

- [x] 3.1 `ai-generate` 顶层 try/catch → `fail(humanizeAgentError)`
- [x] 3.2 `agent-error-humanize.js` + workspace 渲染脱敏
- [x] 3.3 `assertRequiredDeps(AI_GENERATE_REQUIRED_DEPS)` 注册期校验

## 4. Tests and gate

- [x] 4.1 `tests/temporal-anchor.test.js` / `agent-error-humanize.test.js` / `ipc-free-helper-guard.test.js`
- [x] 4.2 `npm test` + `npm run lint`
- [x] 4.3 Round 2 code-review 更新
