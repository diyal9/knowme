# agent-context-assembly — 静默个性化统一包

## ADDED Requirements

### Requirement: 统一本轮生效个性化包

系统 SHALL 为每轮生成产出统一的 Effective Personalization Packet，供普通对话与快捷入口复用。

#### Scenario: 包内仅含可信个性化信号

- **WHEN** 构建本轮个性化包
- **THEN** 仅包含用户手填协作偏好与已确认习惯
- **AND** 设置中的关于我/行业仍可通过 system 用户画像注入
- **AND** MUST NOT 把未确认的 telemetry 当作偏好

#### Scenario: 普通对话与快捷入口同源

- **WHEN** 用户通过快捷入口或普通输入发送
- **THEN** 两者使用同一套个性化摘要逻辑，不得各自拼装互相冲突的协作提示

### Requirement: 轻对话保留短偏好摘要

`chat` tier SHALL 注入严格限长的已确认偏好摘要，使最常见对话路径也能静默沿用习惯。

#### Scenario: chat 仍带偏好

- **WHEN** 用户在普通聊天发送消息且存在已确认习惯或手填偏好
- **THEN** 请求中 SHALL 包含限长个性化摘要（默认不超过 4 条）

#### Scenario: 预算裁剪可解释

- **WHEN** 条数上限导致部分习惯未注入
- **THEN** 个性化包 SHALL 记录被裁掉的条目或原因，供 UI 解释
