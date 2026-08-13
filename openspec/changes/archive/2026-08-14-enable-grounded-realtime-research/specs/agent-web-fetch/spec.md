## ADDED Requirements

### Requirement: Agent can discover public web results before fetching pages
Agent 工具面 MUST 提供公开网页搜索能力，接受查询词、网页或新闻模式、可选时间范围和结果上限，成功时返回标题、目标 URL、摘要、来源、可用发布时间与本次检索时间。搜索摘要 MUST 被标记为发现线索，MUST NOT 被冒充为已读取的原文证据。

#### Scenario: News search returns bounded results
- **WHEN** Agent 以新闻模式搜索“AI”并指定最近一天
- **THEN** 工具返回数量受限、URL 去重的结果
- **AND** 每个结果包含可追溯 URL 与本次检索时间

#### Scenario: Search result is followed by page fetch
- **WHEN** 助手要输出某条资讯的具体事实
- **THEN** 助手使用网页抓取工具读取对应公开页面
- **AND** 将搜索摘要与页面正文证据区分记录

### Requirement: Web search is bounded and fails honestly
联网搜索 MUST 具有独立超时、响应体上限、结果数量上限与总字符上限；供应商超时、HTTP 错误、响应格式无效或无结果时 MUST 返回稳定错误码和可读说明，MUST NOT 伪造结果。

#### Scenario: Search provider times out
- **WHEN** 默认搜索 provider 在超时窗口内未响应
- **THEN** 工具中止请求并返回 `timeout`
- **AND** 整轮 Agent 可选择其他真实来源或诚实降级

#### Scenario: Search response contains unsafe target
- **WHEN** 搜索结果 URL 指向环回、私有或非 http/https 目标
- **THEN** 该结果被过滤
- **AND** 该目标不会进入后续网页抓取
