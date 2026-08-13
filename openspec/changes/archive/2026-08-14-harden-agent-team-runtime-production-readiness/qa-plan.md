# QA Plan: harden-agent-team-runtime-production-readiness

## Risk Focus

1. 子 Run 状态由 legacy Map、Launcher handle 与 RunManager 产生分歧。
2. 损坏 JSONL/state 被 tolerant replay 静默跳过，重复副作用或终态。
3. 内容哈希被误当发布者认证，篡改/撤销/权限扩大仍可执行。
4. remote client 存在但服务不可用时被错误判 READY，live 缺条件时伪造 PASS。
5. 重复 terminal、取消风暴和 timeout 留下 waiter/timer/launch 资源。

## Smoke Scope

- [x] 根 Run 启动/取消兼容，子 Run 查询/取消/终态只走 RunManager/RunStore。
- [x] 重复 terminal/callback 只提交一次，duplicate metric 可见。
- [x] event 末尾截断可恢复；中段坏 JSON、seq/hash 篡改、损坏 state fail-closed。
- [x] active 进程恢复为 INTERRUPTED，继续/重试/放弃保持安全语义。
- [x] 多调用方取消同一树在 3s 内收敛，active launches/waiters/timers/process leaks 为 0。
- [x] 幂等 receipt 阻止重复副作用，冲突收据不覆盖首结果。
- [x] 完整 SHA-256 锁、可信 Ed25519 签名通过；篡改、未知/撤销 key、权限扩大未审阅拒绝。
- [x] hash-only 明确为 integrity-only，不展示 authenticated publisher。
- [x] remote readiness 真实握手；timeout、disconnect、capability 缺失返回稳定错误。
- [x] hermetic Agent Service 成功/失败/澄清/取消/恢复/超时/断连全部有结构化结果。
- [x] live 缺 token/endpoint/service 时报告 BLOCKED/ADVISORY、重跑命令与缺失条件。
- [x] runtime metrics 无 prompt/token/authorization/tool args 等敏感内容。

## Automated Commands

```bash
node --test tests/agent-runtime-production-readiness.test.js tests/agent-team-runtime-core.test.js tests/agent-team-runtime-integration.test.js
node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/runtime-production-readiness-gates.js
node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/agent-service-hermetic-e2e.js
node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/agent-service-live-e2e.js
npm test
npm run lint
npm run test:agent-eval -- --out openspec/changes/harden-agent-team-runtime-production-readiness/evidence/eval-report
node .cursor/scripts/harness.js gate --json
openspec validate harden-agent-team-runtime-production-readiness --strict
```

## Live Preconditions

- Cursor：显式 endpoint/token 与支持版本化 Agent Service 的 backend。
- Claude：显式 endpoint/token 与 execute/status/cancel/resume capability。
- Daemon：`KNOWME_WORKBENCH_URL`、Workbench token 和在线服务。
- 缺任一条件不伪造 PASS；报告 `BLOCKED` 或 `ADVISORY`。

## Exit Criteria

- 所有 hermetic、专项、全量 test/lint/eval/harness 硬门禁 PASS。
- live PASS 或有真实 BLOCKED/ADVISORY 结构化证据；产品行为 FAIL 不得降级。
- 开发自测 → 制作人验收 → 测试 QA 顺序完整，无未记录 BLOCKING。
