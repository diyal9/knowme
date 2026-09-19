# Test Report: establish-context-engine

- 日期：2026-08-27
- 结论：**CONTEXT ENGINE V2 PASS / REPOSITORY GATES PASS / LIVE PROVIDER CANARY PENDING**

## 自动化结果

| 范围 | 结果 | 证据 |
|---|---|---|
| 仓库硬门禁 | PASS | `npm run check` 完整退出 0；Node、lint、Renderer、TypeScript 全通过 |
| Node 全量 | PASS | 1896 项；1845 pass、51 skip、0 fail；360 suites |
| Renderer 全量 | PASS | 70 files、417 tests 全通过；`surface-css-contract.spec.ts` 17/17 |
| Lint/架构/Prompt | PASS | architecture、nocheck、lint、CSS cascade、script scope 全通过；22 个专家 Prompt 为 0 error / 0 warning |
| Renderer TypeScript | PASS | `tsc --noEmit -p tsconfig.json` |
| Lib TypeScript | PASS | `npm run typecheck:lib` |
| Context Engine 核心 | PASS | 信任角色、critical budget、去重/冲突、渐进加载、manifest 与会话裁剪回归通过 |
| Embedding hardening | PASS | 缓存字节上限、8192 维、输入/响应上限、index 完整性、single-flight、waiter Abort 与 50 路并发通过 |
| 黄金评测 | PASS | 专家身份、no-tools、中英/伪 XML 注入、会议相关性与覆盖检查通过 |
| 故障注入 | PASS | 429、503、超时、畸形 JSON、超大响应、重复 index、熔断降级通过 |
| 双 Provider 契约 | PASS | OpenAI 与 DashScope OpenAI-compatible 请求/响应契约自动化通过 |
| 聚合指标/SLO | PASS | p95、降级率、缓存命中、熔断、token 节省、安全不变量和 warming/healthy/degraded 状态通过 |
| Control Plane | PASS | platform/bundled control 才进入 system；persona/SOP/Skill/任务事实/偏好均为受限 user context |
| 最终工具面 | PASS | 有 Web ToolRecord 才加载 Web contract；空工具面不加载任何工具协议；研究路由只装配一次 |
| Token/History | PASS | tokenizer adapter、校准估算、1-token 严格边界、完整 turn 淘汰和可选摘录摘要通过 |
| i18n | PASS | `zh-CN`、`en-US` 实体 pack、router strings、fallback 与 pack version 通过 |
| Chat 行为评测 | PASS（离线） | 4 个确定性 case 与评分器通过；无凭据执行脚本按设计 skip |

## 真实 Provider canary

以严格模式执行 `npm run test:context-engine:providers`。当前进程未配置 `OPENAI_API_KEY` 与 `DASHSCOPE_API_KEY`，OpenAI、DashScope 均报告 `credential_missing`，命令按门禁语义退出 1；未发送外部请求，也未产生付费调用。

以严格模式执行 `npm run test:context-engine:chat-canary`。当前进程未配置 Chat API Key 与 Model，脚本报告 `credential_or_model_missing`，命令按门禁语义退出 1；未发送回答正文，正式执行时报告只包含检查结果、匿名 model hash 与 response hash。

发布环境启用远程 `active` 前必须不带 `--allow-skip` 执行同一命令，并记录脱敏后的 provider、host、latency、dimensions 与成功状态。任何鉴权、限流、响应结构或延迟异常均阻止 active 发布，但不影响默认 off/本地词面降级。

## 反模式评估

V2 继续消除了 system 权限泛化、意图猜工具、二次 system 拼接、persona/Skill 巨型字符串、固定 ReAct 步数、locale 伪国际化与仅估算不校准等反模式。仓库硬门禁已经全绿；真实 canary 尚缺发布凭据，因此结论保持 conditional，不宣称远程 active 或目标 Chat 模型已经完成发布签核。

## 残余验证

- 使用发布环境 OpenAI 与 DashScope 用户凭据执行真实 canary。
- 上线后观察至少 20 个有效语义样本，使 SLO 从 warming 进入可判定状态。
- 真机抽查专家规划、成果讨论、普通 chat、正式专家执行各一轮，重点观察模型自称与长会话连续性。
