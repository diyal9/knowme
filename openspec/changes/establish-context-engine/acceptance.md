# Acceptance: establish-context-engine

- 日期：2026-08-27
- 角色：制作人
- 结论：**CONDITIONAL PASS**（仓库硬门禁与离线/契约验证通过；远程 active 发布待真实双 Provider canary）

## 用户结果

专家协作不再依赖一段更长的提示词去“压住”通用工作伙伴身份。当前专家身份、协作阶段和执行权限已经成为独立的运行时事实：规划与成果讨论保留专家 persona，同时在工具面和模型请求两侧强制 `no-tools`。

系统提示词从固定大字符串改为按 locale、场景、真实工具能力和预算加载的 ContextBlock。只有平台/内置 core、scene、tool contract 可以进入 system；专家 persona、Soul/SOP、Skill、任务事实和用户偏好统一以受限 user context 进入。最终工具表解析后只装配一次提示词，预览 IPC 使用同一投影规则；每轮产出不含正文和本地路径的 ContextManifest。

外部 Embedding 现在是可选 Provider：知识检索与 Context Engine 独立开关，Context 支持 off/shadow/active。网络预排序位于同步装配器之前；缓存字节预算、输入/响应上限、短超时、独立 waiter 取消、single-flight、熔断和隐私门控失败时均回退本地词面选择。

## 验收标准

| 标准 | 结果 | 证据 |
|---|---|---|
| 专家不被通用工作伙伴覆盖 | PASS | scene identity claim 高于 persona/data；专家会话使用 `personaExpertId`；专家场景排除通用伙伴昵称/Soul |
| 规划/讨论含 Slash Skill 仍无工具 | PASS | `executionPolicy=no-tools` fail-closed；空内建/连接器工具面；模型 `toolsEnabled=false` |
| 用户原文不被拼成 system prompt | PASS | Renderer 发送 raw prompt + structured discussion context；Main 装配 scene/task blocks |
| chat 基础提示词 ≤1200 字符 | PASS | 722 字符，约 427 tokens |
| 带工具基础提示词 ≤2200 字符 | PASS | 1332 字符，约 727 tokens |
| 渐进加载与稳定降级 | PASS | capability gating、optional topK、词面/置信度/时效/可插拔向量排序；embedding 失败回退 |
| ContextManifest 可观测且隐私安全 | PASS | block/source/content hash、预算、冲突和省略原因；不含正文、路径、可读 source label |
| locale fallback | PASS | `zh-CN`、`en-US` 实体 pack；router strings 同步国际化；未知 locale 回退 `zh-CN` |
| 普通助手与正式执行不回归 | PASS（Context 范围） | Node 1896 项：1845 pass、51 skip、0 fail；正式 expertId 能力绑定保留 |
| System role 最小化 | PASS | `sourceTrust + authority + kind` 联合门控；persona/SOP/Skill/事实/偏好不进入 system |
| 最终工具面一致 | PASS | ToolRecord 推导 capability；无 Web/Feishu 工具时不加载对应 contract；单次 finalization |
| Prompt 治理 | PASS | schema + runtime validation + CI lint；22 个内置专家 0 error / 0 warning |
| Token 与历史 | PASS | tokenizer adapter、校准估算、严格裁剪、完整 turn 压缩和有界摘录摘要 |
| ReAct 自适应 | PASS | 简单 1–2、一般 2–4、复杂 3–6 步；无固定数量填充 |
| Outcome 可观测 | PASS | 身份漂移、无关自我介绍、无工具执行声明、重试与匿名模型维度 |
| Embedding 配置与密钥隔离 | PASS | 检索/Context 独立开关；独立凭据 safeStorage；跨 Host 禁止继承主 Key |
| Shadow/Active 语义选择 | PASS | shadow 只观测；active 只向同步 assembler 传 optional vectorScores |
| 向量稳定降级 | PASS | 短超时、Abort、严格向量校验、16 MiB/512 条 LRU、single-flight、三次失败熔断；异常回退词面 |
| 敏感上下文边界 | PASS | sensitive 候选未授权时不调用远程 Embedding，manifest 只含匿名 telemetry |
| 关键控制面不可截断 | PASS | core/scene/tool contract 标记 critical；块级与会话级双预算不足均返回 `critical_context_budget_exceeded` |
| 并发和资源有界 | PASS | 8192 维、总输入、响应体、cache bytes/provider state 均有上限；50 路同请求合并为一次调用；单 waiter 取消不传播 |
| 生产可观测性 | PASS | 匿名聚合 p95、降级率、缓存命中、熔断、token 节省、安全不变量与 SLO 状态 |
| 黄金与故障门禁 | PASS | 专家身份、no-tools、中英/伪 XML 注入、相关性黄金集；429/503/超时/畸形/超大/重复 index 故障注入 |
| Context/Lib 门禁 | PASS | Node、lint、`typecheck:renderer`、`typecheck:lib` 全部通过 |
| 仓库总门禁 | PASS | `npm run check` 退出 0；Node 1845 pass / 51 skip、Renderer 417 pass、lint/Prompt lint/TypeScript 全通过 |

## 条件项

当前环境没有 Embedding 与 Chat Provider 凭据/模型，因此两类真实 canary 在严格模式下分别报告 `credential_missing` 与 `credential_or_model_missing` 并退出 1，未发起付费网络请求。契约、故障注入、离线行为 case 和隐私安全评分已自动化通过；启用远程 `active` 或签核目标 Chat 模型前，仍须使用发布环境用户凭据执行真实 canary。

## 制作人判断

本次已经从“调一段 prompt 文案”升级为可扩展的 Context Engine：身份、控制面、来源信任、实际工具能力、Prompt Schema、locale、预算、历史、资源上限、并发取消、Outcome SLO 和外部语义信号都有代码级约束。Context Engine 与仓库自动化门禁达到生产候选标准；完成真实 Provider/模型 canary 和真机体验抽查后，才能签署远程 active 的发布级完成。
