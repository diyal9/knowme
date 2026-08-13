# QA Plan — unify-local-team-daemon-hitl-lifecycle

## Smoke Scope

- [ ] Daemon 进行中任务：任务房间出现「停止」，点击后顶栏「已取消」，SSE/轮询停止
- [ ] Daemon HITL（clarify/gate）：顶栏「等待你」，与 local Agent Graph gate 等待文案一致
- [ ] Local Agent Graph 进行中：「停止」仍可用（回归）
- [ ] 任务列表/最近任务：daemon 与 local 状态 badge 语义一致（进行中/待处理/完成）

## Automated

- `npm test` — workbench-task-lifecycle、workbench-daemon-client
- `npm run lint`

## Live / BLOCKED

- 需配置 `KNOWME_WORKBENCH_TOKEN` 与在线 Daemon：`POST cancel` 端到端 — **BLOCKED** 若本环境无 token

## 反模式

- 取消后仍显示「执行中」或继续轮询
- HITL 等待时顶栏显示「已完成」
- Daemon 无停止入口而 local 有
