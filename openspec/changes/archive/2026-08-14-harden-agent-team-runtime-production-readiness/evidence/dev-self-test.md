# 开发自测

## 结论

PASS。生产就绪专项、全量测试、lint、Agent eval、OpenSpec strict validate 与 hermetic E2E 均通过。

## 范围

- 子 Run 生命周期仅由 `AgentRunManager` / `AgentRunStore` 持有，保留 root controller 兼容入口。
- event JSONL 校验 seq、prevHash、recordHash；只容忍尾部截断，中段损坏 fail-closed。
- package lock 使用 SHA-256；Ed25519 签名、可信 publisher、公钥撤销和权限扩张审阅 fail-closed。
- remote readiness 校验握手和能力，timeout/disconnect 归一化并计数。
- metrics 覆盖 queue、cancel、recovery、duplicate terminal、resource leak、protocol/trust rejection。

## 自动化结果

| 命令 | 结果 |
|---|---|
| `node --test tests/agent-runtime-production-readiness.test.js` | PASS，14/14 |
| `node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/agent-service-hermetic-e2e.js` | PASS，8/8 |
| `node openspec/changes/harden-agent-team-runtime-production-readiness/evidence/runtime-production-readiness-gates.js` | PASS，hard gate |
| `npm test` | PASS，1423/1423 |
| `npm run lint` | PASS |
| `npm run test:agent-eval` | PASS，6/6 |
| `npx openspec validate harden-agent-team-runtime-production-readiness --strict` | PASS |

## 发现与修复

1. adopted root 的 `run.started` 事件会在 snapshot 的 `lastSeq` 过滤后从 `replay.events` 消失。修复为保留完整 `events`，另提供仅用于状态归并的 `appliedEvents`。
2. Windows 全量测试首次出现 connector 临时文件原子 rename `EPERM`；单测复跑及全量复跑均通过，判定为共享工作区瞬时文件占用，不属于本 change 的功能回归。
3. remote timeout 测试暴露未清理 socket 风险；移除 timeout timer 的 `unref` 并确保 harness 主动释放服务资源。

## 边界

- hash 仅证明内容完整性，不宣称发布者身份；身份认证仅在可信 Ed25519 key 完成签名验证后成立。
- live 后端结果由独立脚本采集；缺少 token/endpoint 时必须报告 `BLOCKED` 或 `ADVISORY`，不得计为 PASS。
