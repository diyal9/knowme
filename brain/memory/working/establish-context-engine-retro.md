# establish-context-engine retro

## 背景

专家页暴露的“自称工作伙伴”不是单句文案问题，而是平台身份、用户伙伴 persona、专家 persona、场景协议和执行权限共享同一字符串拼接链导致的权限冲突。原方案基础 prompt 约 4K，重复规则多，且讨论阶段的禁用工具主要依赖模型服从。

## 本次决策

- 以 ContextBlock、ContextPolicy、ContextManifest 建立统一装配协议。
- platform、scene、persona、data、user 明确 authority；不可信资料不能提升权限。
- `personaExpertId` 与 `expertId` 分离；专家规划/讨论用 no-tools 硬约束。
- 内置提示词按 locale 和稳定 block ID 管理，保留旧 API facade 做渐进迁移。
- 可选上下文确定性优先，词面/置信度/时效为默认排序；向量仅是可插拔补充。
- 日志只保留哈希 manifest，不保留 system prompt、记忆正文和路径。

## 结果

- chat 核心由约 4K 收敛为 521 字符；带工具核心 1131 字符。
- 动态上下文从单体字符串拆为可独立裁剪的 blocks。
- 同类 block 合并为少量 provider messages，基准平均约 0.69ms/次。
- 主助手链路的 Workflow ReAct 和后置研究协议也进入 Context Engine/manifest。

## 经验

1. 身份冲突必须靠 authority 和单一有效 identity 解决，不能继续追加“不要自称 X”。
2. 权限必须在运行时工具投影和模型参数上执行，prompt 只能解释，不能授权。
3. 国际化的正确单位是稳定 prompt block，不是把整段 system prompt 放进翻译表。
4. 向量检索适合大量可选数据，不适合安全、身份、场景和少量固定规则。
5. 可观测性必须默认隐私安全；“不记录正文”仍不够，source path/label 也要哈希。

## 后续

- 增加第二语言包时先补 snapshot/eval，不自动翻译用户内容。
- 若 optional 候选规模增长到数百以上，再评估复用现有本地索引生成 vectorScores；不在请求关键路径启动新 embedding 服务。
- OpenAI/DashScope 真实 canary 需要发布环境提供各自凭据；无凭据环境只运行契约与故障注入门禁。

## Embedding 增量

- 外部 Embedding 以可选 Provider 接入，不改变同步 assembler：Main 先异步准备 vectorScores，再执行原确定性装配。
- 知识检索与 Context Engine 分别使用 `semanticRerank` 和 `contextSemanticMode`，避免一个开关隐式扩大成本与数据发送范围。
- off 是零网络默认；shadow 只比较；active 才改变 optional topK。候选不超过 topK 时直接跳过。
- 候选向量按 provider/model/content hash 放入有界 LRU，并使用 single-flight；Context 网络等待上限 1500ms，连续三次失败后短时熔断。
- 独立 Host 必须使用独立 Key；只有继承或同源 Endpoint 才能复用主模型 Key。敏感候选未获授权时整轮语义混排降级，避免部分向量覆盖把敏感候选隐式降权。
- 24 候选基准中，off 平均约 0.003ms，缓存命中的 active 平均约 0.116ms；真实 Provider 仍需用户凭据做连通与模型维度冒烟。

## Production Hardening 增量

- 反模式复核发现“untrusted authority=data 但 provider role=system”的标签式安全漏洞；现已改为 user 数据区 JSON 封装，旧 contextMessage 与附件正文也走同一边界。
- core/scene/tool contract 新增 critical 语义，assembler 和最终对话预算器均不允许截断；预算不足时明确拒绝。
- 向量缓存增加 16 MiB 字节上限，单向量维度降为 8192，并限制总输入、响应体和 index 完整性。
- single-flight 的 Provider 请求不再绑定首个调用者 AbortSignal；50 路并发专项测试只产生一次 Provider 调用。
- 新增匿名聚合 SLO 与黄金身份/no-tools/多语言注入评测；CSS typography 契约恢复通过。
