# Acceptance: establish-context-engine

- 日期：2026-08-26
- 角色：制作人
- 结论：**CONDITIONAL PASS**（仓库硬门禁与离线/契约验证通过；远程 active 发布待真实双 Provider canary）

## 用户结果

专家协作不再依赖一段更长的提示词去“压住”通用工作伙伴身份。当前专家身份、协作阶段和执行权限已经成为独立的运行时事实：规划与成果讨论保留专家 persona，同时在工具面和模型请求两侧强制 `no-tools`。

系统提示词从固定大字符串改为按 locale、场景、能力和预算加载的 ContextBlock。用户原始输入保持 user role；检索、记忆、附件、legacy contextMessage 和 Renderer 任务投影均以低权限 user 数据进入，不能因包装文字获得 system 权限；每轮产出不含正文和本地路径的 ContextManifest。

外部 Embedding 现在是可选 Provider：知识检索与 Context Engine 独立开关，Context 支持 off/shadow/active。网络预排序位于同步装配器之前；缓存字节预算、输入/响应上限、短超时、独立 waiter 取消、single-flight、熔断和隐私门控失败时均回退本地词面选择。

## 验收标准

| 标准 | 结果 | 证据 |
|---|---|---|
| 专家不被通用工作伙伴覆盖 | PASS | scene identity claim 高于 persona/data；专家会话使用 `personaExpertId`；专家场景排除通用伙伴昵称/Soul |
| 规划/讨论含 Slash Skill 仍无工具 | PASS | `executionPolicy=no-tools` fail-closed；空内建/连接器工具面；模型 `toolsEnabled=false` |
| 用户原文不被拼成 system prompt | PASS | Renderer 发送 raw prompt + structured discussion context；Main 装配 scene/task blocks |
| chat 基础提示词 ≤1200 字符 | PASS | 521 字符，约 311 tokens |
| 带工具基础提示词 ≤2200 字符 | PASS | 1131 字符，约 611 tokens |
| 渐进加载与稳定降级 | PASS | capability gating、optional topK、词面/置信度/时效/可插拔向量排序；embedding 失败回退 |
| ContextManifest 可观测且隐私安全 | PASS | block/source/content hash、预算、冲突和省略原因；不含正文、路径、可读 source label |
| locale fallback | PASS | 内置核心与五类场景位于 `zh-CN` pack；未知 locale 回退 `zh-CN` |
| 普通助手与正式执行不回归 | PASS | Node 1830 项：1779 pass、51 skip、0 fail；Renderer 392/392；正式 expertId 能力绑定保留 |
| Embedding 配置与密钥隔离 | PASS | 检索/Context 独立开关；独立凭据 safeStorage；跨 Host 禁止继承主 Key |
| Shadow/Active 语义选择 | PASS | shadow 只观测；active 只向同步 assembler 传 optional vectorScores |
| 向量稳定降级 | PASS | 短超时、Abort、严格向量校验、16 MiB/512 条 LRU、single-flight、三次失败熔断；异常回退词面 |
| 敏感上下文边界 | PASS | sensitive 候选未授权时不调用远程 Embedding，manifest 只含匿名 telemetry |
| 关键控制面不可截断 | PASS | core/scene/tool contract 标记 critical；块级与会话级双预算不足均返回 `critical_context_budget_exceeded` |
| 并发和资源有界 | PASS | 8192 维、总输入、响应体、cache bytes/provider state 均有上限；50 路同请求合并为一次调用；单 waiter 取消不传播 |
| 生产可观测性 | PASS | 匿名聚合 p95、降级率、缓存命中、熔断、token 节省、安全不变量与 SLO 状态 |
| 黄金与故障门禁 | PASS | 专家身份、no-tools、中英/伪 XML 注入、相关性黄金集；429/503/超时/畸形/超大/重复 index 故障注入 |
| 仓库硬门禁 | PASS | `npm run check`、`npm run typecheck:lib`、CSS typography contract 全部通过 |

## 条件项

当前环境没有 `OPENAI_API_KEY` 与 `DASHSCOPE_API_KEY`，因此 `npm run test:context-engine:providers -- --allow-skip` 对两个真实 Provider 均明确报告 skipped，未发起付费网络请求。OpenAI 与 DashScope 的 OpenAI-compatible 契约及故障注入已自动化通过；但启用远程 `active` 模式面向发布前，仍须使用发布环境用户凭据执行一次真实 canary，核对 Endpoint、鉴权、维度、延迟和配额策略。

## 制作人判断

本次已经从“调一段 prompt 文案”升级为可扩展的上下文基础设施，身份、权限、数据可信度、预算、资源上限、并发取消、聚合指标和外部语义信号均有代码级约束。默认 off、本地词面和 shadow 路径已达到仓库级生产候选标准；远程 active 路径在真实双 Provider canary 完成后可进入发布签核。
