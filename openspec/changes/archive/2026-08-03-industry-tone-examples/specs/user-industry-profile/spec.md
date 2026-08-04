# user-industry-profile Specification (delta)

## ADDED Requirements

### Requirement: Industry selection in personal memory settings

设置页「我的记忆」MUST 提供行业单选；默认 `general`（通用办公）；非法值 MUST 回落为 `general`。

#### Scenario: Default industry

- **WHEN** 用户首次打开设置且从未配置行业
- **THEN** 行业控件显示「通用办公」，持久化字段为 `general`

#### Scenario: Persist industry choice

- **WHEN** 用户选择「游戏」并保存设置后重新打开
- **THEN** 行业控件仍为「游戏」

#### Scenario: Invalid industry falls back

- **WHEN** 磁盘 settings 中 `industry` 为未知值
- **THEN** 加载后规范化为 `general`

### Requirement: Industry does not replace free-text profile

行业字段 MUST 与「关于我」「协作偏好」并存；不得清空或替代自由文本。

#### Scenario: Profile text preserved

- **WHEN** 用户已填写「关于我」并切换行业
- **THEN** 「关于我」文本保持不变
