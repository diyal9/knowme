# QA Plan — Agent Package and Team Runtime

## Test Strategy

本变更以协议契约、真实父子 Executor、故障恢复和 Electron 用户体验四层验证。所有自动测试必须离线可重复；Daemon 和 Electron live smoke 作为 Story 完成门禁证据。

## Smoke Scope

- [x] 导入并校验两个不同来源的 Agent Package，创建包含两者的 Team Workflow。
- [x] 父 Run 委派真实子 Run，子 Run 使用独立 Session、Expert 快照和工具子集。
- [x] 串行 handoff、有限并行 join、子错误上浮和 gate rollback 可见。
- [x] 父 Run 取消后 3 秒内所有子 Run 与后台进程终止，running leak 为 0。
- [x] 模拟应用重启后可查询 Run Event Log，并恢复安全 checkpoint 或显示 INTERRUPTED。
- [x] 写操作保持 draft → approve → applied；恢复和双击审批不重复副作用。
- [x] Run 时间线显示 Agent、handoff、审批、Artifact、Evidence、预算与停止原因。
- [x] 未授权工具、未知协议版本、无证据事实和子 Agent 指令注入均 fail-closed。
- [x] 控制台无 uncaught error，最终回答不展示工具轮草稿。

## Automated Coverage

- Package/Team manifest 与 Message Envelope schema 单测。
- RunManager 生命周期、Run 树、Scheduler 并发/预算、公平性和 cancel cascade 单测。
- RunStore append-only、原子 snapshot、损坏尾行、重启恢复、幂等 receipt 单测。
- Tool Registry per-Run allowlist、timeout、AbortSignal、approval 和审计脱敏单测。
- AgentRunExecutor 真实父子集成：success/error/cancel/timeout/waiting approval。
- Conversation Eval：跨 Builder、delegate cancel、approval pending、evidence aggregation、prompt injection、budget exhaustion。
- Output Protocol/Renderer：子 Run 事件映射、seq 去重、单 terminal、answer lane 不泄漏。

## Commands

```bash
npm test
npm run lint
npm run test:agent-eval
npm run test:daemon-e2e
node .cursor/scripts/harness.js gate --json
```

## Evidence

- `evidence/dev-self-test.md`
- `evidence/eval-report.json`
- `evidence/gate-check.json`
- `evidence/orchestration-e2e.json`
- `evidence/cancel-recovery-smoke.json`
- `evidence/test-report.md`
- `evidence/screenshots/`

## Exit Criteria

- 全部硬门禁通过。
- 跨 Builder Team Workflow 与真实子 Run E2E 通过。
- 父取消 ≤3 秒且无资源泄漏。
- 恢复不重复外部副作用。
- 制作人验收和测试 QA 均签字通过。
