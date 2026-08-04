# ai-assistant Specification (delta)

## ADDED Requirements

### Requirement: Industry injected into assistant personalization

AI 助手上下文 MUST 在用户已选择行业时注入明确的行业陈述与口吻倾向；该信息 MUST 作为用户明确提供的 profile，不得覆盖产品固定安全规则。

#### Scenario: Industry in light personalization

- **WHEN** settings.industry 为 `software`
- **THEN** 轻量个性化上下文包含「用户所属行业：互联网/软件」一类明确陈述

#### Scenario: Industry tone in user prompt assembly

- **WHEN** 组装系统侧用户偏好提示词
- **THEN** 包含行业口吻提示，并要求缺事实时仅用占位示例、禁止编造真实项目名
