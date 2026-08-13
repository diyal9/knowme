## Why

KnowMe 会把“帮我看下今天关于 AI 的资讯”误判为闲聊，关闭工具后再由模型凭空生成单一“飞书知识库”选项，既无法交付实时信息，也让用户误以为产品缺乏任务理解与自主研究能力。现在需要补齐开箱即用的联网搜索与证据化研究闭环，使工作伙伴能直接完成时效性问题，而不是把内部工具选择转嫁给用户。

目标用户：需要追踪行业动态、产品更新、政策与市场信息的知识工作者，以及希望把企业知识与公开信息结合分析的团队用户。

商业化与体验价值：可靠的实时研究能力能扩大 KnowMe 从“内部知识助手”到“日常工作伙伴”的使用频次与任务覆盖，并通过来源可追溯、连接器融合和失败诚实降级形成付费专业能力与用户信任基础。

## What Changes

- 识别“今天、最新、近期、资讯、新闻、动态”等时效性公开信息任务，自动开启研究工具与工作上下文。
- 新增无密钥、可替换 provider 的内置 `search_web` 工具，支持网页/新闻模式、时间范围、结果上限和来源元数据。
- 基于本轮真实 Tool Registry 发现可搜索来源，自动组合内置网页搜索、网页正文读取、知识库及已启用连接器；不维护固定来源按钮名单。
- 为实时研究建立 task frame 与证据门禁，要求成功搜索后再输出实时事实，并鼓励读取多个原始页面核验。
- 调整助手策略：能力可用时直接执行；只有来源范围会实质改变结果或所有能力不可用时才追问；禁止生成单项来源选择或无工具证据的“已检索”表述。
- 复用现有 `suggestion → choice.ready` 协议与 UI，不重做结构化选择组件。

验收标准：

- 输入“帮我看下今天关于 AI 的资讯”时，KnowMe 直接执行“搜索网络 → 读取来源 → 核验依据”，不出现只有“飞书知识库”的选择卡。
- 最终回答包含可追溯 URL，并区分来源发布时间与本次检索时间；搜索或读取失败时不编造资讯。
- 已启用知识库、飞书或 MCP 搜索能力时，KnowMe 可按问题范围自动融合；未启用的来源不会出现在候选或执行说明中。
- 普通问候仍走轻量 `chat`，既有网页 URL 读取、飞书工作流和结构化选择行为不回归。

非目标（Non-goals）：

- 不实现登录态浏览器爬取、绕过付费墙、验证码或站点访问控制。
- 不承诺搜索供应商永久可用；provider 必须可替换并在失败时诚实降级。
- 不新增多选 UI，不重做 Agent 输出协议、执行过程布局或 Capability Hub。
- 不把搜索结果摘要等同于原文，也不在没有工具证据时提供“今日最新”事实。

## Capabilities

### New Capabilities
- `agent-realtime-research`: 时效性任务识别、真实来源发现、联网搜索、原文读取、来源融合与证据化输出。

### Modified Capabilities
- `ai-assistant`: 助手对实时公开信息任务改为自主执行，并限制虚构来源、单项选择和无证据执行声明。
- `agent-web-fetch`: 网页能力从仅支持已知 URL 扩展为搜索结果发现后继续安全读取原文。
- `tool-contract-registry`: 工具契约可声明研究语义，使内置与连接器工具按真实能力参与来源路由。

## Impact

- `src/lib/chat-intent.js`、`conversation-grounding.js`：实时研究意图与工作上下文。
- 新增 `src/lib/research-routing.js`、`src/lib/web-search.js`：任务路由与内置搜索 provider。
- `src/lib/agent-web-tools.js`、`tool-surface-builder.js`、`main.js`：工具定义、注册和运行时注入。
- `src/lib/agent-grounding-runtime.js`、`ai-assistant-context.js`：证据门禁与助手行为约束。
- `tests/` 与 `openspec/changes/enable-grounded-realtime-research/evidence/`：单测、Agent 回归和桌面验收证据。
- 不新增 npm 依赖，不改变 Renderer IPC 或用户数据格式。
