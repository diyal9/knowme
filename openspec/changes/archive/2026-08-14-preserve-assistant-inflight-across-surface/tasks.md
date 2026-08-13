## 1. Inflight chat registry

- [x] 1.1 在 `workspace-agent.js` 增加 sessionId → chatHistory 保活 Map；`runAI` 开始时登记，`finally`/取消路径释放
- [x] 1.2 `resolveAssistantRef`（及同类查找）搜索当前历史 + 保活历史，保证离屏流事件可落点
- [x] 1.3 `activateSession`：若目标 Session 有保活历史则复用，否则走磁盘 hydrate
- [x] 1.4 完成态更新 Session 列表元数据时使用 run 发起时的 sessionId，避免写到切面后的 activeSession

## 2. Tests & evidence

- [x] 2.1 `tests/workspace-agent.test.js` 增加静态契约：保活 Map、activate 优先保活、resolve 搜保活、runSessionId 绑定
- [x] 2.2 补充 `qa-plan.md`；跑 `npm test` 与 `npm run lint`；写 `evidence/dev-self-test.md`
