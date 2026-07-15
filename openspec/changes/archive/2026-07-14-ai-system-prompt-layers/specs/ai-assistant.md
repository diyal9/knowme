# Spec Delta: ai-assistant

## ADDED Requirements

### Requirement: Layered system prompt

AI 助手发送给模型的 system 消息 MUST 由产品固定底座与可选用户偏好、可选知识/记忆层拼接而成；用户 MUST NOT 能删除或覆盖固定底座。

#### Scenario: Empty user preference

- **WHEN** 用户未填写偏好提示词且存在知识/记忆上下文
- **THEN** system 内容包含固定底座与知识/记忆段落，且不包含空的「用户偏好」标题块

#### Scenario: With user preference

- **WHEN** 用户在设置中填写了偏好（如专业领域、回答风格）
- **THEN** system 在固定底座之后包含该偏好，再接知识/记忆（若有）

### Requirement: Settings shows user preference only

设置页 MUST 将原「System Prompt」改为用户可填写的偏好提示词，并说明其用途为领域/风格补充。

#### Scenario: Label and placeholder

- **WHEN** 用户打开设置 → AI 页
- **THEN** 可见「用户偏好提示词」及引导占位文案（专业领域、回答风格），默认可为空

#### Scenario: Migrate legacy default

- **WHEN** 已有配置的 `systemPrompt` 等于历史默认整段助手人格
- **THEN** 加载后偏好字段为空，且后续保存写入 `userPrompt`

#### Scenario: Preserve custom legacy text

- **WHEN** 已有配置的 `systemPrompt` 为用户自定义且不等于历史默认
- **THEN** 该文案作为 `userPrompt` 展示与使用

### Requirement: Multi-turn chat context

侧栏连续对话 MUST 将近期有效轮次一并提交给模型。

#### Scenario: Second turn sees first turn

- **WHEN** 用户第一轮提问得到助手回复后，再次发送第二轮需求
- **THEN** `ai-generate` 请求的 messages 中包含第一轮的 user 与 assistant 内容（在长度截断策略内）
