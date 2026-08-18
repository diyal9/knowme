## QA Plan — harden-agent-runtime-resilience-and-governance

## Scope

- 状态源收口：RunManager-only 路径与 legacy 依赖剥离。
- 远程降级：健康探针、自动降级、阻断策略与审计信息。
- 供应链治理：签名校验、来源校验、吊销阻断。
- 预算治理：Team/Workspace 级预算阈值与熔断。

## Smoke Checklist

- [ ] Run 查询/取消/恢复在关闭 legacy 路径后行为一致。
- [ ] 远程探针触发阈值时按策略自动降级或阻断。
- [ ] 降级事件在时间线和运行详情中可追溯。
- [ ] 无签名/签名失效/来源异常 Package 被 fail-closed 拒绝。
- [ ] 命中吊销列表的 Package 运行前被阻断。
- [ ] Team 预算超限触发熔断并阻断新增高成本调度。

## Anti-pattern Checks

- [ ] 不出现“后端已降级但用户无感知”的静默切换。
- [ ] 不出现“签名失败仍可安装”的绕过路径。
- [ ] 不出现“预算超限仍持续调度”的失控行为。

## Evidence

- Daemon live E2E：`openspec/changes/harden-agent-runtime-resilience-and-governance/evidence/`
- 故障注入与预算熔断测试报告：同目录 `evidence/`
- 门禁结果：`npm test`、`npm run lint`、`harness gate --json`
