## 1. Recovery backoff

- [x] 1.1 为 timeout 类别配置更长的指数退避（network 保持短退避）；补齐/更新 `agent-recovery` 单测
- [x] 1.2 导出或复用统一文案助手（超时 / 等待第 N 次重试）

## 2. Process tools abort

- [x] 2.1 `runTaskOnce` / `run_task` handler 响应 abort signal，超时或取消时 kill 子进程
- [x] 2.2 单测：abort 后进程条目不再保持 running

## 3. Executor paths

- [x] 3.1 `main.js` 工具超时 race：结算时 `cancelProcessesForRun`，退避等待前 emit 可见重试摘要
- [x] 3.2 `agent-run-executor.js` 同步超时杀进程 + 指数退避可见重试

## 4. Timeline UX

- [x] 4.1 确认进度卡对超时/重试摘要的友好标题（必要时微调 `workspace-agent` / grounding 文案）
- [x] 4.2 失败步骤内联展示可读原因（`buildToolDisplaySummary` + 时间线 hint），禁止只显示空洞「操作失败」

## 5. Verification

- [x] 5.1 `npm test` 与 `npm run lint` 通过；写 `evidence/dev-self-test.md`
