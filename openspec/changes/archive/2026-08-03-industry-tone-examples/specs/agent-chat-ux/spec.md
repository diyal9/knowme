# agent-chat-ux Specification (delta)

## ADDED Requirements

### Requirement: Industry-flavored empty today-priority examples

当「今日优先级」判定飞书日程与未完成待办均为空时，助手 UI MUST 用当前行业 catalog 确定性改写正文：说明无可用飞书事实、请用户提供 1 个真实工作目标，并给出最多 3 条占位示例；MUST 标明示例不是真实任务；MUST NOT 展示模型生成的 suggestion 选项栏。

#### Scenario: Game industry empty facts

- **WHEN** 用户行业为 `game` 且今日优先级工具结果日程/待办均为 0
- **THEN** 展示正文包含游戏向占位示例（如数值表/活动配置/版本风险），且不含销售合同签署类示例

#### Scenario: General industry empty facts

- **WHEN** 用户行业为 `general` 且同上空事实
- **THEN** 展示中性办公占位示例

#### Scenario: Non-empty Feishu facts unchanged

- **WHEN** 今日优先级工具返回非空日程或待办
- **THEN** 不使用空态占位模板，正常展示模型基于事实的 Top3 输出
