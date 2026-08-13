## ADDED Requirements

### Requirement: Empty-state kicker may be omitted

能力包 `ui.emptyStateKicker` MAY 为空字符串；当 kicker 为空时，空状态分组 DTO 与 Renderer MUST NOT 展示 kicker 行，且 MUST NOT 回退显示 pack 名称作为 kicker。

#### Scenario: Blank kicker is hidden

- **WHEN** 已启用能力包的 `emptyStateKicker` 为空
- **THEN** 空状态分组仍包含 hero / sub / scenes
- **AND** Renderer MUST NOT 渲染可见的 kicker 文本（含「游戏工作室」）

#### Scenario: Non-empty kicker still shown

- **WHEN** 能力包声明非空 `emptyStateKicker`
- **THEN** Renderer SHALL 照常显示该 kicker
