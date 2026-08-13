## MODIFIED Requirements

### Requirement: 当前执行节点圆点进行中动效

管线审阅「步骤」Tab 的中轴时间线圆点，在节点处于当前执行中（含 `active` / `running` / `waiting` 或等价 `is-current`）时，MUST 呈现可持续感知的脉冲或呼吸动效，用以表达「流程正在此节点」。已完成、待执行、失败节点的圆点 MUST NOT 使用该进行中动效。当用户环境启用减少动态效果时，MUST 关闭或显著减弱该动效，但仍 MUST 保留当前节点的静态高亮（色相/描边可辨）。

#### Scenario: 执行中当前节点有脉冲

- **WHEN** 用户打开管线审阅「步骤」Tab 且存在当前执行中节点
- **THEN** 该节点中轴圆点显示持续脉冲/呼吸动效，相邻非当前节点圆点无此动效

#### Scenario: 减少动态效果时仍可辨

- **WHEN** 系统启用 `prefers-reduced-motion: reduce` 且存在当前执行中节点
- **THEN** 当前节点圆点无脉冲动画（或仅极弱），但仍通过静态色/描边与待执行节点可区分
