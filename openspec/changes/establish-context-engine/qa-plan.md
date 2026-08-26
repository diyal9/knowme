# QA Plan: establish-context-engine

## 核心场景

- [x] S1 专家规划：办公协作专家中询问“你有什么能力”，有效 identity 为当前专家，系统底座不覆盖为通用工作伙伴。
- [x] S2 专家规划 + Slash Skill：输入 `/meeting-summary`，工具投影为空，模型请求不发送 tools。
- [x] S3 成果讨论：Renderer 只发送原始用户输入和结构化任务事实；讨论不重跑任务、不读取连接器。
- [x] S4 普通 chat：只加载 core.runtime、core.conversation、core.integrity、core.output，不加载 Web/飞书/suggestion 协议。
- [x] S5 普通 assist/retrieval：仅当实际开放相应能力时加载 Web、飞书或结构化选择协议。
- [x] S6 正式专家执行：`expertId` 继续绑定 Skills/Connectors；`personaExpertId` 不改变执行授权。
- [x] S7 超长上下文：保护所有已选前导 system blocks，从最旧完整轮次开始省略历史，保留最新用户输入。
- [x] S8 locale 缺失：回退 `zh-CN`，用户自定义文本不翻译、不改写。
- [x] S9 embedding 失败：optional selector 回退确定性和词面排序，请求不失败。
- [x] S10 隐私遥测：manifest 不出现记忆正文、文件路径和可读 source label。
- [x] S11 默认关闭：`contextSemanticMode=off` 时零 Embedding 网络请求，继续词面选择。
- [x] S12 Shadow：计算匿名 `wouldChange`，但实际 topK 不改变。
- [x] S13 Active：有效向量只改变 optional data block 排序，必选 block、身份与权限不受影响。
- [x] S14 敏感边界：未授权时不发送 sensitive block；启用授权后才允许进入远程 Embedding。
- [x] S15 Provider 隔离：独立 Host 没有独立 Key 时拒绝创建客户端，不把主模型 Key 转发过去。
- [x] S16 稳定降级：超时、取消、非法维度、NaN、零向量、数量错误与连续失败均回退词面；三次失败后短时熔断。
- [x] S17 性能：候选向量按 provider/model/content hash 缓存，相同请求 single-flight；候选不超过 topK 时跳过。
- [x] S18 信任角色：中文、英文和伪 XML 注入正文只出现在 user 数据区，system 消息不含攻击 marker。
- [x] S19 旧旁路：legacy contextMessage、便签和 Renderer 事实投影同样进入不可信数据封装。
- [x] S20 关键预算：core/scene/tool contract 不截断；预算不足返回 critical_context_budget_exceeded。
- [x] S21 身份预算：紧凑 scene identity 完整保留，长 persona/SOP 可在剩余预算内裁剪。
- [x] S22 资源上限：向量缓存同时满足 512 条和 16 MiB 上限；维度、总输入、响应体均受限。
- [x] S23 并发取消：一个 waiter Abort 不影响共享调用；50 路同请求只调用一次 Provider。
- [x] S24 故障注入：429、503、超时、畸形 JSON、超大响应和重复 index 均确定性降级。
- [x] S25 双 Provider：OpenAI 与 DashScope OpenAI-compatible 契约自动化通过；真实 canary 脚本无凭据时显式跳过。
- [x] S26 聚合观测：p95、降级率、缓存命中、熔断、token 节省和安全不变量生成匿名 SLO 快照。
- [x] S27 黄金门禁：专家身份、no-tools、三类注入和相关性选择全部通过。

## 反模式检查

| 反模式 | 期望 |
|---|---|
| A1 单体万能 prompt | 核心、场景、persona、工具、任务和数据为独立 block |
| A2 提示词承担权限控制 | no-tools 在工具面、研究路由、grounding 和模型请求中硬执行 |
| A3 Renderer 注入 system prompt | Renderer 只能提交 raw input 与结构化事实 |
| A4 persona 与能力绑定混为 expertId | personaExpertId 与 expertId 分离 |
| A5 每轮加载全部工具协议 | 按实际 capabilityIds 渐进加载 |
| A6 向量决定安全/身份 | 向量只参与 optional data 排序，且可完全缺席 |
| A7 重复个性化/事实规则 | 核心事实边界单一；显式 userPrompt 与已确认习惯去重 |
| A8 双重裁剪 | Context Engine 使用原始动态候选段统一预算；旧 orchestrator 输出仅保留兼容 |
| A9 多 system 消息放大请求开销 | 相邻同缓存/信任策略 block 合并为 provider 消息，manifest 仍保持 block 粒度 |
| A10 遥测泄露原文或路径 | 只记录 source 类型和哈希 |
| A11 每轮全量远程向量化 | off/候选阈值门控；候选向量 LRU，只请求 query 与 miss |
| A12 Embedding 阻塞主请求 | Context 短超时、Abort、熔断，异常返回空分数 |
| A13 主模型 Key 发往新 Host | 只有继承或同源 Endpoint 可复用；跨 Host 必须独立 Key |
| A14 部分向量覆盖造成隐私候选降权 | 未授权 sensitive 候选存在时整轮语义选择降级，不做不完整混排 |
| A15 标签式安全 | untrusted 正文使用低权限 user role，而不是带警告文字的 system role |
| A16 优先级冒充硬保护 | critical 控制块不可截断，预算不足 fail-closed |
| A17 条目上限冒充内存上限 | LRU 同时限制条目数和估算字节数 |
| A18 Single-flight 共享取消 | waiter 取消与 Provider Promise 生命周期隔离 |
| A19 单轮日志冒充可观测性 | 聚合指标、SLO 阈值和不变量违规状态齐备 |
| A20 微基准冒充生产验证 | 黄金集、并发、故障注入、双 Provider 契约和真实 canary 分层 |

## 回归范围

## Smoke Scope

- [x] 专家规划与成果讨论保持当前专家身份并强制 no-tools
- [x] 普通 chat、正式专家执行与知识检索主链路不回归
- [x] Context Engine 信任边界、critical budget、黄金注入与 Embedding 故障降级
- [x] Node、Renderer、lint、CSS、Renderer/lib TypeScript 与 OpenSpec strict

## 完整回归

- Node 全量测试与 lint
- Renderer 全量测试、相关专家协作测试和 TypeScript 检查
- OpenSpec strict validate
- Context Engine 微基准与 prompt 字符/token 预算
- 真机建议：专家规划、成果讨论、普通 chat、正式专家执行各一轮
- 发布环境：配置 OpenAI 与 DashScope 凭据后运行 `npm run test:context-engine:providers`
