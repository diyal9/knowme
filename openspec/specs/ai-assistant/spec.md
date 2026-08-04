# ai-assistant Specification

## Purpose

定义 KnowMe AI 助手的系统提示词分层、对话温度与多轮上下文组装行为。

## Requirements

### Requirement: Layered system prompt

AI 助手发送给模型的 system 消息 MUST 由产品固定底座与可选用户偏好、可选知识/记忆层拼接而成；用户 MUST NOT 能删除或覆盖固定底座。

#### Scenario: Empty user preference

- **WHEN** 用户未填写偏好提示词且存在知识/记忆上下文
- **THEN** system 内容包含固定底座与知识/记忆段落，且不包含空的「用户偏好」标题块

#### Scenario: With user preference

- **WHEN** 用户在设置中填写了偏好（如专业领域、回答风格）
- **THEN** system 在固定底座之后包含该偏好，再接知识/记忆（若有）

### Requirement: Settings shows user preference only

设置页 AI 区 MUST 保留「用户偏好提示词」，并 MUST 增加「对话温度」控件。

#### Scenario: Label and placeholder

- **WHEN** 用户打开设置 → AI 页
- **THEN** 可见「用户偏好提示词」及引导占位文案（专业领域、回答风格），默认可为空

#### Scenario: Temperature control visible

- **WHEN** 用户打开设置 → AI 页
- **THEN** 可见对话温度控件（范围 0–2）及简要说明（低=严谨，高=发散）

#### Scenario: Migrate legacy default

- **WHEN** 已有配置的 `systemPrompt` 等于历史默认整段助手人格
- **THEN** 加载后偏好字段为空，且后续保存写入 `userPrompt`

#### Scenario: Preserve custom legacy text

- **WHEN** 已有配置的 `systemPrompt` 为用户自定义且不等于历史默认
- **THEN** 该文案作为 `userPrompt` 展示与使用

### Requirement: Configurable chat temperature

对话请求 MUST 使用设置中的温度；缺省 0.7；合法范围 0–2。

#### Scenario: Default temperature

- **WHEN** 用户未配置过温度
- **THEN** `ai-generate` 使用 `temperature: 0.7`

#### Scenario: Custom temperature applied

- **WHEN** 用户在设置中将对话温度设为 `0.3` 并保存
- **THEN** 随后的 `ai-generate` 请求体包含 `temperature: 0.3`

#### Scenario: Out-of-range clamped

- **WHEN** 持久化或传入的温度小于 0 或大于 2
- **THEN** 实际发送前被钳制到 `[0, 2]`

### Requirement: Natural-language user turn

发给模型的本轮 user 消息 MUST 以用户输入原文为主；MUST NOT 强制添加「需求：」前缀。

#### Scenario: Plain greeting

- **WHEN** 用户发送「你好」且无便签正文上下文
- **THEN** messages 中最后一条 user.content 为「你好」（或等价原文），不含「需求：」前缀

#### Scenario: Optional note context

- **WHEN** 存在非空活动文件正文
- **THEN** 可将正文作为「参考文件正文」块附在用户消息中，且说明其为可选上下文，不要求模型只做提示词改写

### Requirement: Work-partner base persona

固定底座 MUST 将助手定位为工作伙伴（问答、协作、结构化输出），提示词优化仅为能力之一；MUST NOT 要求默认只输出提示词正文。

#### Scenario: Casual multi-turn

- **WHEN** 用户连续两轮闲聊式提问
- **THEN** 助手按对话回答；第二轮 messages 仍包含第一轮 user/assistant（在历史预算内）

### Requirement: Multi-turn chat context

侧栏/工作台连续对话 MUST 将近期有效轮次一并提交给模型；送模历史默认上限至少 12 轮（仍可被字符预算截断）。

#### Scenario: Second turn sees first turn

- **WHEN** 用户第一轮提问得到助手回复后，再次发送第二轮需求
- **THEN** `ai-generate` 请求的 messages 中包含第一轮的 user 与 assistant 内容（在长度截断策略内）

#### Scenario: Longer thread retained

- **WHEN** 用户在同一 Session 完成超过 6 轮有效问答且未触发 Session compact 丢弃
- **THEN** 新请求 history 中至少可包含超过 6 轮的近期内容（在 `MAX_MESSAGE_CHARS` 与 Session 预算内）

### Requirement: Industry injected into assistant personalization

AI 助手上下文 MUST 在用户已选择行业时注入明确的行业陈述与口吻倾向；该信息 MUST 作为用户明确提供的 profile，不得覆盖产品固定安全规则。

#### Scenario: Industry in light personalization

- **WHEN** settings.industry 为 `software`
- **THEN** 轻量个性化上下文包含「用户所属行业：互联网/软件」一类明确陈述

#### Scenario: Industry tone in user prompt assembly

- **WHEN** 组装系统侧用户偏好提示词
- **THEN** 包含行业口吻提示，并要求缺事实时仅用占位示例、禁止编造真实项目名

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
