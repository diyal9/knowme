# agent-chat-ux — 本轮沿用可解释

## ADDED Requirements

### Requirement: 静默生效且可解释

助手回复 SHALL 在有个性化注入时提供低干扰说明，MUST NOT 恢复输入框旁记忆勾选条。

#### Scenario: 回复旁提示沿用习惯

- **WHEN** 本轮实际注入了至少 1 条已确认习惯或手填偏好
- **THEN** 该条助手消息附近展示「本轮沿用了你的习惯」类提示
- **AND** 用户可展开查看具体条目

#### Scenario: 无个性化时不打扰

- **WHEN** 本轮未注入任何个性化条目
- **THEN** MUST NOT 展示空的沿用提示

#### Scenario: 不恢复勾选条

- **WHEN** 用户打开 Agent 对话
- **THEN** 输入框上方 MUST NOT 出现记忆勾选芯片
