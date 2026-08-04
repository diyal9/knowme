## ADDED Requirements

### Requirement: External link tool routing guidance

系统提示词 MUST 明确区分外部链接与飞书链接的处理方式：用户消息中出现 http/https 链接时，非 feishu/larksuite 域的链接 MUST 引导模型使用网页抓取工具，feishu/larksuite 域的链接 MUST 引导模型使用飞书文档读取工具。提示词 MUST NOT 只举飞书工具为例来概括「外部资料」的处理方式。

#### Scenario: Prompt names the web fetch tool for external URLs

- **WHEN** 组装系统提示词且网页抓取工具在本轮可用
- **THEN** 提示词包含「外部 http(s) 链接使用网页抓取工具」的明确指引
- **AND** 包含「飞书/larksuite 链接使用飞书文档读取工具」的区分说明

#### Scenario: No connector-only phrasing when web fetch exists

- **WHEN** 网页抓取工具在本轮可用
- **THEN** 提示词中关于「外部资料必须先调用工具」的表述 MUST NOT 只列举飞书工具

### Requirement: No capability denial when a fetch tool exists

当网页抓取工具在本轮可用时，助手 MUST NOT 声称「无法访问外部网页」「不支持爬取」「没有联网能力」，也 MUST NOT 在未尝试抓取的情况下要求用户手动复制粘贴网页正文或改为提供飞书文档 token。

#### Scenario: Assistant attempts fetch before asking the user

- **WHEN** 用户给出外部文章链接并要求基于它写作，且抓取工具可用
- **THEN** 助手先调用抓取工具
- **AND** MUST NOT 在未调用工具前回复「请手动复制粘贴内容」或「请提供飞书文档 token」

#### Scenario: Honest failure instead of capability denial

- **WHEN** 抓取工具调用后失败
- **THEN** 助手说明具体失败原因（超时/状态码/被安全策略拦截/类型不支持）
- **AND** MUST NOT 把失败表述为「我没有访问外部网页的能力」
