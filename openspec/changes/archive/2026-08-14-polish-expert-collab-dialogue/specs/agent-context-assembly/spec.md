## ADDED Requirements

### Requirement: Layered prompt stack for expert collaboration

与专家协作时，context assembly MUST 按分层栈注入提示词，并明确 KnowMe 对话结构默认层与专家层的关系：

1. KnowMe 对话结构默认（输出协议、伙伴协作边界、引用/诚实等产品约束）
2. AgenticType 模式脚手架
3. 专家 Soul
4. 专家 SOP
5. 专家属性/能力与协作方式摘要
6. Session 任务与知识范围
7. 技能匹配/显式 slash 正文

KnowMe 默认层的安全与输出协议约束 MUST NOT 被专家 Soul/SOP 关闭。用户显式 `/slash` 技能正文 MAY 覆盖 SOP 中的方法细节，但 MUST NOT 削弱默认层协议约束。

#### Scenario: Expert session assembles layered blocks

- **WHEN** 绑定专家的 Session 进入 assist/retrieval 装配
- **THEN** 上下文同时包含 KnowMe 默认结构约束与该专家的 Soul/SOP（或兼容 SOP）及 Agentic 脚手架
- **AND** 装配结果可区分各层来源（便于测试与诊断）

#### Scenario: Different experts yield different expert layers

- **WHEN** 用户分别与两位 Soul/SOP 不同的专家协作
- **THEN** 两 Session 注入的专家层内容不同
- **AND** KnowMe 默认结构层保持一致策略

#### Scenario: Legacy flat systemPrompt still injects

- **WHEN** 专家快照仅有旧 systemPrompt
- **THEN** 系统将其作为 SOP 层注入
- **AND** 不因缺少 Soul 字段而失败

### Requirement: Agentic scaffold follows session agenticType

装配 MUST 读取 Session 快照中的 `agenticType` 并注入对应模式脚手架；无类型时 MUST 按 `react` 处理。

#### Scenario: Planning scaffold present for planning experts

- **WHEN** 快照 `agenticType` 为 `planning`
- **THEN** 装配输出含规划模式脚手架文本或等价结构化指令
