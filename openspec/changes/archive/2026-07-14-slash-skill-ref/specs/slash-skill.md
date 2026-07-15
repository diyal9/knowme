# slash-skill-ref Specs

## Requirements

### Requirement: Custom skill with slash

用户 MUST 能在设置知识库新建技能，并设置用于 `/` 引用的 `slash` 命令。

#### Scenario: Create skill

- **WHEN** 用户填写标题、slash、正文并保存
- **THEN** `skills/` 下出现带 `slash` 的概念，列表可见

### Requirement: Slash picker in AI assist

AI 助写输入框 MUST 在用户输入 `/` 时展示可过滤的技能列表。

#### Scenario: Pick skill

- **WHEN** 用户输入 `/` 并选择一项
- **THEN** 输入框插入 `/<slash>` 令牌

### Requirement: Referenced skill injected

发送助写请求时，MUST 将被引用技能正文注入动态上下文。

#### Scenario: Send with slash

- **WHEN** prompt 含匹配的 `/slash`
- **THEN** system 动态上下文包含该技能文档
