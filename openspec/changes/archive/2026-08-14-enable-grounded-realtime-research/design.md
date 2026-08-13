## Context

See `proposal.md` for motivation and `specs/` for observable behavior. 当前链路先用 `chat-intent` 决定 `chat|assist|retrieval`，`chat` 会关闭重上下文和全部工具；“帮我看下今天关于 AI 的资讯”不命中既有工作动词，因此走 `chat`。即便升到 `assist`，现有 `fetch_web_page` 也只能读取已知 URL，不能发现网页。模型生成的 `suggestion` 没有服务端来源校验，因而会出现单项“飞书知识库”。

工具生产路径已经统一为 `resolveToolSurfaceForRun()` → Tool Registry → Executor；EvidenceLedger、ToolLedger 与 task frame 已能强制必需工具成功。设计应复用这些边界，不在 Renderer 增加第二套研究状态机。

## Goals / Non-Goals

**Goals:**

- 以最小本地规则识别明确的时效研究任务，普通闲聊不增加启动和请求成本。
- 提供无需 API Key 的基础搜索，并允许后续替换 provider。
- 从实际投影的工具定义与契约发现来源，融合内置、知识库和连接器。
- 用既有 grounding 门禁阻止无搜索证据的“最新事实”输出。
- 全部网络访问位于 Electron 主进程，Renderer 只消费既有工具事件。

**Non-Goals:**

- 不实现浏览器登录、JS 渲染搜索、验证码处理或付费墙绕过。
- 不保证公共搜索 provider 的 SLA，不把 provider 绑定成不可替换产品协议。
- 不增加多选 UI，不改变 IPC 与 Agent 输出协议。
- 不自动调用所有来源；只提供研究计划与强制最低证据，具体工具组合仍受模型与预算控制。

## Decisions

### D1. 用专门研究分类补充现有 tier，而不是新增第四个 tier

`research-routing` 先判断任务是否需要新鲜公开事实，再把误判的 `chat` 提升为 `assist`。保留 `chat|assist|retrieval` 可以避免改动预算、模型路由和大量测试；研究语义通过 task frame 与动态上下文表达。

替代方案是新增 `research` tier，但会扩散到模型策略、上下文预算、缓存和遥测，收益不足。

### D2. 内置 `search_web` 使用可注入 RSS provider

默认 provider 使用公开 RSS 搜索接口：新闻模式走 Bing News RSS，网页模式走 Bing Web RSS；模块只依赖 Node 全局 `fetch` 和小型 XML 解码，不增加 npm 依赖。`searchWeb(query, options)` 接受 `fetchImpl` 与 endpoint builder，单测完全使用 mock，后续可切换官方 API 或组织代理。

搜索只负责发现，结果包含 URL、摘要、可能的发布时间和 `retrievedAt`。具体事实仍由 `fetch_web_page` 读取正文。响应受 10 秒、1 MiB、最多 10 条与总字符上限约束。

### D3. URL 安全采用同步字面校验与抓取时 DNS 复核

搜索响应中的 URL 先过滤非 http(s)、localhost、字面私网地址与无效 URL；真正读取页面时继续经过 `web-fetch` 的 DNS、重定向和 SSRF 校验。这样不为每条搜索线索做 DNS 查询，也不会绕过执行前安全边界。

### D4. 来源发现消费 Registry 投影结果

`research-routing` 接收 `toolSurface.getToolDefinitions()`。优先读取 `_knowme.research` 语义；对 MCP 等外部定义只保守匹配工具名和描述中的 search/query/retrieval 语义，并保留真实 tool name。它输出：

- `intent`: 是否研究、公开/内部/混合范围、新闻/网页模式和 recency；
- `sources`: 本轮真实可用的来源描述；
- `taskFrame`: 公开时效任务要求 `search_web` 成功；
- `context`: 告知模型默认综合执行、搜索摘要非原文、何时允许追问。

外部搜索连接器作为可选增强；基础公开事实仍要求稳定的内置 `search_web`，避免把动态 MCP 名称写入不可满足的固定 task frame。

### D5. 先装配工具面，再生成研究 task frame

`main.js` 在 `resolveToolSurfaceForRun()` 后调用路由器，以保证来源列表反映 enable/allowlist 和实际投影状态。生成的 `taskFrame`、`researchContext` 通过既有 production run ports 进入 Executor；不新增 IPC。

为使研究意图在工具组装前生效，先对原始 tier 做轻量 `promoteIntentTier()`；工具面完成后再做完整来源发现。这是两阶段同一纯模块，不产生状态分叉。

### D6. 复用 grounding 的 requiredTools，并增加研究证据提示

公开时效任务的 task frame 至少包含 `requiredTools: ['search_web']` 与对应 tool-result evidence。Executor 已会把工具结果合并到 EvidenceLedger 并通过 OutputGate fail-closed。模型被提示从搜索结果中选取多个页面调用 `fetch_web_page`；首版不把“至少读取两页”设为硬门禁，以免站点 403 导致所有研究不可交付，但最终答案必须如实标注未读取原文的条目。

### D7. UI 只展示既有工具时间线

`search_web` 增加产品化标题“搜索网络”，`fetch_web_page` 保持“读取网页”。正常路径直接执行，不产生选择卡。只有路由判断范围歧义或无能力时，模型才可使用现有 `suggestion`，并受提示词约束不得生成单项选择。

## Electron Boundaries

- Renderer：发送原始用户输入，消费现有 `stage/tool/answer/choice` 事件；无网络搜索代码、无 token、无新 IPC。
- Main process：意图提升、Tool Registry 装配、RSS 搜索、网页抓取、来源发现和 task frame 注入。
- External network：仅由 `search_web`/`fetch_web_page` handler 发起，受超时、体积、协议和 SSRF 边界约束。

启动性能不变：新模块无顶层网络或磁盘 I/O，仅在非 `chat` Run 中构建工具；搜索结果在单轮内存中受限，不持久化全文。

## Risks / Trade-offs

- [公共 RSS 接口变更或限流] → provider 可注入；稳定错误码；连接器可作为备用；不伪造结果。
- [RSS 摘要质量与发布时间不一致] → 摘要仅作发现线索；正文读取后再下结论；区分 `publishedAt` 与 `retrievedAt`。
- [模型仍少读原文] → 工具描述、研究上下文和 Agent eval 三层约束；后续可将多页读取提升为硬 completion condition。
- [关键词启发式误触发] → 同时要求时效/资讯语义；普通问候与不相关“动态效果”加入负例测试。
- [MCP 名称推断误判] → 只基于实际投影且只提供建议语义，不提升权限、不自动执行、不加入硬 requiredTools。
- [搜索供应商可观察查询词] → 搜索结果不落盘；设计和产品文案明确公开检索会把查询发送到供应商。

## Migration Plan

1. 新工具随现有 `needsConnectorTools` 投影，无用户数据迁移和设置迁移。
2. 单测通过后，以同一问句执行 Electron 冒烟，确认工具时间线和来源链接。
3. 若公共 provider 异常，可回滚 `search_web` 注册与研究意图提升；既有 `fetch_web_page`、知识库和飞书流程保持独立可用。
