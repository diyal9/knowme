## 1. Run 权威与可观测性

- [x] 1.1 移除 `main.js` legacy `activeSubRuns` 双轨，保留根 Run controller 兼容并让子树取消只走 RunManager
- [x] 1.2 增加 runtime metrics collector，并接入 RunManager/Launcher/RunStore 的队列、取消、恢复、重复终态与资源诊断
- [x] 1.3 强化 RunStore event/state 完整性检查，只容忍可证明的末尾截断并对中段损坏 fail-closed

## 2. Package 信任链

- [x] 2.1 实现递归 canonicalization、完整 SHA-256 lock 和 legacy hash 显式迁移状态
- [x] 2.2 实现 Ed25519 发布者签名、可信 key policy、撤销和签名载荷校验
- [x] 2.3 实现权限差异与 review receipt 校验，并将 strict trust 接入 Package load/materialize 边界

## 3. 故障与后端门禁

- [x] 3.1 加强 remote readiness/timeout/disconnect/capability 错误语义，禁止登记式成功
- [x] 3.2 新增确定性 fault/chaos 测试，覆盖重复 callback、损坏日志、进程中断、取消风暴、幂等副作用和资源泄漏
- [x] 3.3 扩展 hermetic Agent Service E2E，覆盖成功、失败、澄清、取消、恢复、超时和断连
- [x] 3.4 新增 live E2E 结构化 `PASS/FAIL/BLOCKED/ADVISORY` 报告、缺失条件和可复跑命令

## 4. 验证与证据

- [x] 4.1 运行 OpenSpec strict validate、专项 runtime/package/fault 测试并修复真实问题
- [x] 4.2 运行 `npm test`、`npm run lint`、Agent eval 和 harness gate
- [x] 4.3 生成 runtime/fault/hermetic/live/metrics 结构化 evidence
- [x] 4.4 完成 `dev-self-test.md`、`acceptance.md`、`evidence/test-report.md` 和 `code-review.md`
