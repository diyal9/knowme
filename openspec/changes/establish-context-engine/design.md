# Design

## Architecture

`src/lib/context-engine/` 是纯装配基础设施，不直接读取文件、访问网络或执行工具。调用方提供候选 ContextBlock；引擎负责规范化、确定性选择、可选语义选择、冲突检测、预算裁剪、消息装配和 manifest。

上下文权限顺序为 platform → scene → persona → data → user。每个 block 声明 kind、authority、trust、priority、maxTokens、source、locale、cachePolicy 与 critical。稳定可信控制前缀先装配，不可信任务/检索/记忆进入最终 user 数据区，用户原始输入保持在最后。

## Trust and Critical Budget

- `trust=untrusted` 的正文只以 JSON 数据封装进入 user role；文字标签不再替代消息权限隔离。
- core、scene 与 tool contract 默认 `critical=true`。关键 block 必须完整进入请求，不允许按比例截断。
- assembler 先计算关键 block 的实际 token；超过 block 上限或总安全预算时抛出 `critical_context_budget_exceeded`。
- 对话适配器再次保留最新用户输入预算并校验 8K system 上限；不满足时 fail-closed。
- 专家执行身份使用独立紧凑 scene identity block，完整 persona/SOP 可在剩余预算内裁剪。

## Progressive Loading

- always：最小身份、事实诚实和输出规则。
- scene：当前场景与阶段协议。
- capability：仅在运行时实际开放相应工具时加载 Web、飞书和结构化选择协议。
- persona：仅加载当前专家 Soul/SOP/属性。
- optional：Skill、记忆、知识与历史成果按 scope、相关性、置信度、时效和预算选择。

确定性匹配始终优先于语义匹配。安全、身份、阶段和权限不得由向量相似度决定。语义选择器只处理 optional block，并在 embedding 不可用或失败时回退词面排序。

## Remote Embedding Selection

Embedding 是 Context Engine 的可插拔外部信号，不进入同步装配器。Main 在 ContextBlock 候选生成后执行异步语义预排序，得到 `vectorScores` 与匿名 telemetry，再调用纯同步 `assembleContext`。因此网络、缓存和 Provider 失败不会改变冲突解决、权限或预算算法。

- `semanticRerank` 继续只控制知识检索重排；`contextSemanticMode=off|shadow|active` 独立控制 Context Engine。
- Embedding Endpoint/API Key 默认继承主模型配置，也可单独配置；独立密钥使用 Electron `safeStorage` 加密。
- 只有 optional 的 retrieval、memory、skill、task_fact 和 user_preference 可以成为语义候选；core、scene、persona、tool_contract 与 user_input 永不进入向量选择。
- `sensitive=true` 的候选默认只参加本地词面排序；只有用户显式开启 `embeddingAllowSensitive` 才可发送正文到 Embedding Provider。
- 候选不超过 topK、query 为空、模式关闭或没有可发送候选时跳过网络请求。
- 候选向量按 provider/model/content hash 存入按条目和总字节双重有界的进程内 LRU；并发相同请求 single-flight。调用者取消只停止自身等待，不取消其他调用者共享的 Provider 请求。Context Engine 使用短超时和连续失败熔断，任何异常返回空向量分数。
- shadow 模式计算“若启用会否改变 topK”，但不把向量分数传给装配器；active 模式才参与 optional 排序。

ContextManifest 只记录 mode、status、候选数、缓存命中数、耗时、匿名 provider hash、降级原因和 shadow 差异，不记录 endpoint、模型名、API Key、query 或候选正文。

Embedding 运行时仅接受 http/https 且禁止 URL 内凭据，限制单项/总输入字符、响应体字节和向量维度，并校验 index 完整唯一。OpenAI 与 DashScope 使用同一 OpenAI-compatible 契约测试；真实调用由显式凭据 canary 执行。

## Operations and Evaluation

进程内指标聚合 Context 装配 p95、语义 p95、降级率、缓存命中率、熔断次数、token 使用/节省及安全不变量。SLO 快照只含定长枚举和数值；`untrusted_system_projection` 或 `critical_context_truncated` 一旦出现立即标记 degraded。

`tests/fixtures/context-engine-golden.json` 固化专家身份、no-tools、中文/英文/伪标签注入和相关性选择。该黄金集由 `npm test` 执行，是主 Context Engine 的离线硬门禁；真实 Provider canary 作为有凭据环境的发布前门禁。

## Expert Collaboration Isolation

Agent Session 使用 `personaExpertId` 表达身份来源，`expertId` 继续表达执行能力绑定；`executionPolicy=no-tools` 在专家规划和成果讨论中强制为空工具面。这样既保留专家 persona，又不会恢复 Skill/Connector 权限。

渲染层发送原始用户消息、conversationMode 和结构化 discussion context。主进程解析专家资产并生成场景 block，不信任渲染层提交的自由文本 system prompt。

## Prompt Registry and Locale

内置提示词位于 `context-engine/prompts/<locale>`，使用稳定 block ID。`knowme-system-prompt.ts` 保留为兼容 facade。locale 缺失时回退 `zh-CN`；用户资料和专家自定义正文保持原语言。

## Budget and Performance

Context Engine 使用模型 token 估算器，先按 block 的 maxTokens 裁剪，再按 authority、priority 和原始顺序分配总预算。全部前导 system 消息作为受保护前缀参与裁剪，动态 block 可按优先级丢弃。

manifest 默认只记录 block ID、来源、token、哈希与裁剪原因，不记录完整个人记忆和检索正文。稳定 block 可被 prompt cache 复用；候选语义索引由调用方在后台增量维护。

## Electron Boundaries

- Renderer：只提交用户输入、场景 ID、专家 ID 和结构化任务上下文。
- Main：解析可信专家资产、设置执行策略、收集上下文并调用 Context Engine。
- IPC：不允许 Renderer 直接提交 platform/scene 权限级提示词。
- Context Engine：纯函数与依赖注入，不触碰 Electron API，便于单元测试和启动时惰性加载。

## Compatibility

现有 prompt/router/context APIs 通过 facade 渐进迁移；正式执行链路保持原 Session expertId 和能力绑定。旧专家 `systemPrompt` 继续映射到 SOP。
