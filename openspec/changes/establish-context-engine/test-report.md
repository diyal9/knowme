# Test Report: establish-context-engine

- 日期：2026-08-26
- 结论：**REPOSITORY PASS / LIVE PROVIDER CANARY PENDING**

## 自动化结果

| 范围 | 结果 | 证据 |
|---|---|---|
| 仓库硬门禁 | PASS | `npm run check` exit 0 |
| Node 全量 | PASS | 1830 项；1779 pass、51 skip、0 fail；354 suites |
| Renderer 全量 | PASS | 66 files；392/392 tests |
| Lint/架构/CSS | PASS | architecture、nocheck、lint、CSS cascade、script scope 全通过；typography contract 17/17 |
| Renderer TypeScript | PASS | `tsc --noEmit -p tsconfig.json` |
| Lib TypeScript | PASS | `npm run typecheck:lib` |
| Context Engine 核心 | PASS | 信任角色、critical budget、去重/冲突、渐进加载、manifest 与会话裁剪回归通过 |
| Embedding hardening | PASS | 缓存字节上限、8192 维、输入/响应上限、index 完整性、single-flight、waiter Abort 与 50 路并发通过 |
| 黄金评测 | PASS | 专家身份、no-tools、中英/伪 XML 注入、会议相关性与覆盖检查通过 |
| 故障注入 | PASS | 429、503、超时、畸形 JSON、超大响应、重复 index、熔断降级通过 |
| 双 Provider 契约 | PASS | OpenAI 与 DashScope OpenAI-compatible 请求/响应契约自动化通过 |
| 聚合指标/SLO | PASS | p95、降级率、缓存命中、熔断、token 节省、安全不变量和 warming/healthy/degraded 状态通过 |
| Story Harness | PASS | 5 个 blocking hard gates 全部通过，soft issues 为空 |

## 真实 Provider canary

执行 `npm run test:context-engine:providers -- --allow-skip`。当前进程未配置 `OPENAI_API_KEY` 与 `DASHSCOPE_API_KEY`，OpenAI、DashScope 均按设计报告 skipped；未发送外部请求，也未产生付费调用。

发布环境启用远程 `active` 前必须不带 `--allow-skip` 执行同一命令，并记录脱敏后的 provider、host、latency、dimensions 与成功状态。任何鉴权、限流、响应结构或延迟异常均阻止 active 发布，但不影响默认 off/本地词面降级。

## 反模式评估

QA Plan A1-A19 均有代码约束与自动化证据。A20“微基准冒充生产验证”已通过黄金集、并发、故障注入和双 Provider 契约缓解；真实 canary 尚缺发布凭据，因此总体结论保持 conditional，而非宣称远程 active 已完成生产实证。

## 残余验证

- 使用发布环境 OpenAI 与 DashScope 用户凭据执行真实 canary。
- 上线后观察至少 20 个有效语义样本，使 SLO 从 warming 进入可判定状态。
- 真机抽查专家规划、成果讨论、普通 chat、正式专家执行各一轮，重点观察模型自称与长会话连续性。
