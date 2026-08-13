# QA 测试报告

## 结论

PASS。Hermetic 与仓库硬门禁通过；live 后端证据遵循条件化状态模型，不把缺失环境伪报为成功。

## 自动化验证

| 层级 | 命令 | 结果 |
|---|---|---|
| 专项 | `node --test tests/agent-runtime-production-readiness.test.js` | PASS，14/14 |
| Hermetic E2E | `node evidence/agent-service-hermetic-e2e.js` | PASS，8/8 |
| 生产门禁 | `node evidence/runtime-production-readiness-gates.js` | PASS |
| 全量 | `npm test` | PASS，1423/1423 |
| 静态检查 | `npm run lint` | PASS |
| Agent eval | `npm run test:agent-eval` | PASS，6/6 |
| OpenSpec | `npx openspec validate harden-agent-team-runtime-production-readiness --strict` | PASS |
| Harness gate | `node .cursor/scripts/harness.js gate --json` | PASS，blocking=false |

上述 evidence 命令中的相对路径基于：
`openspec/changes/harden-agent-team-runtime-production-readiness/`。

## 故障矩阵

- duplicate terminal/callback：单一终态交付，重复次数进入 metrics。
- state/event corruption：尾部截断可恢复；中段 JSON、seq、prevHash、recordHash 异常拒绝恢复。
- interruption/recovery：中断标记可重放，恢复结果可观测。
- cancellation storm：并发取消归并，副作用幂等，记录取消延迟。
- timeout/disconnect：结构化错误码，不产生假 readiness。
- package trust：hash、签名、publisher、key revocation、permission review 均有正反向测试。
- resource cleanup：launch handle、timer、socket 在终态后释放，残留计入 resource leak 指标。

## Live 状态

执行：

```bash
node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/agent-service-live-e2e.js
```

本机结果：`BLOCKED`（诚实边界，非硬门禁失败）。

- Cursor：缺少 `KNOWME_CURSOR_AGENT_URL`、`KNOWME_CURSOR_AGENT_TOKEN`
- Claude：缺少 `KNOWME_CLAUDE_AGENT_URL`、`KNOWME_CLAUDE_AGENT_TOKEN`
- Daemon：缺少 `KNOWME_DAEMON_AGENT_URL`、`KNOWME_DAEMON_AGENT_TOKEN`

脚本针对 Cursor、Claude、Daemon 输出结构化 JSON：

- 前置条件齐全且场景成功：`PASS`
- 服务可选但当前不可用：`ADVISORY`
- 必需 token/endpoint/服务缺失：`BLOCKED`

live 状态不参与伪造硬通过；Hermetic 8/8 是本 change 的确定性跨后端契约硬门禁。

## QA 风险判断

- 首次全量测试发生一次 Windows 临时文件 rename `EPERM`，目标为既有 connector 测试；单项和全量复跑均通过。记录为共享环境瞬时占用 advisory。
- Harness 的 repository-wide 扫描报告了其他 active change 的 QA/code-review advisory；本 change 的 `qa-plan.md`、Smoke Scope 和 `code-review.md` 均完整，不受影响。
- 未发现本 change 遗留的 blocking 缺陷。
