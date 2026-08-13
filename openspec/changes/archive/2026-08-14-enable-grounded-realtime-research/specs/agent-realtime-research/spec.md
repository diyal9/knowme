## Purpose

让 KnowMe 对公开时效信息执行可验证的自主研究：识别新鲜度要求，依据本轮真实能力选择并组合来源，在搜索、原文读取与证据核验后交付可追溯答案。

## ADDED Requirements

### Requirement: Time-sensitive research intent opens research capabilities
系统 MUST 将包含明确新鲜度或资讯语义的工作请求识别为研究任务，并 MUST 在运行时提供可用研究工具；普通问候 MUST 保持轻量对话路径。

#### Scenario: Today news request enters research
- **WHEN** 用户发送“帮我看下今天关于 AI 的资讯”
- **THEN** 本轮不被分类为轻量闲聊
- **AND** Agent 获得可用的联网搜索与网页读取工具

#### Scenario: Greeting remains lightweight
- **WHEN** 用户只发送“你好”
- **THEN** 系统保持轻量对话路径
- **AND** 不为该轮装配研究任务框架

### Requirement: Research sources come from actual runtime capabilities
系统 MUST 根据本轮 Tool Registry 中真实可用的搜索、网页读取、知识库和连接器能力生成来源计划，MUST NOT 展示或声称使用未启用、未授权或不存在的来源。

#### Scenario: Built-in and connector sources are available
- **WHEN** 内置联网搜索与一个已启用的知识连接器同时可用
- **THEN** 研究计划可组合公开网络与连接器来源
- **AND** 不要求用户先选择内部工具

#### Scenario: Connector is disabled
- **WHEN** 飞书连接器未启用
- **THEN** 来源计划和降级选项中不出现飞书知识库

### Requirement: Public current facts require successful search evidence
对“今天、最新、近期”等公开信息结论，系统 MUST 在输出前取得至少一次成功的时效搜索证据；具体资讯条目 SHOULD 继续读取多个结果页面以核对原文、来源与时间。

#### Scenario: Successful current-news research
- **WHEN** 搜索返回多个公开结果且其中至少两个原始页面可读
- **THEN** 助手基于读取证据汇总资讯
- **AND** 最终答案包含可追溯 URL、来源发布时间与本次检索时间
- **AND** 来源折叠区使用产品统一的文字、展开标记、间距和无项目符号列表，不显示浏览器默认样式

#### Scenario: Search fails
- **WHEN** 所有可用的时效搜索工具均失败或无结果
- **THEN** 助手明确说明真实失败原因或无结果状态
- **AND** MUST NOT 输出声称属于今天或最新的具体资讯

### Requirement: Source questions are exceptional and executable
当研究能力足够且来源范围不会实质改变结果时，系统 MUST 默认综合执行而非询问来源。只有公开/内部范围会改变任务含义，或没有任何可执行研究来源时，系统 MAY 通过结构化选择请求用户决策。

#### Scenario: Default public-news request runs directly
- **WHEN** 用户请求今天的 AI 资讯且内置联网搜索可用
- **THEN** KnowMe 直接开始研究
- **AND** MUST NOT 展示只有一个“飞书知识库”项目的来源选择

#### Scenario: Privacy scope changes the task
- **WHEN** 用户说“查一下最新项目动态”且公开网络与企业内部来源均可用，但未说明项目范围
- **THEN** 系统可请求用户选择公开信息、内部信息或综合范围
- **AND** 每个选项都绑定本轮真实可执行的来源路径
