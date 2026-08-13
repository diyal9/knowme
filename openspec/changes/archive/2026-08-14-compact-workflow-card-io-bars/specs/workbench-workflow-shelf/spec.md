## MODIFIED Requirements

### Requirement: Compact IO summary bars

工作流货架卡与维护管理卡上的「输入」「产出」摘要 MUST 以上下两行全宽矩形背景条展示，且垂直尺寸 MUST 与同卡「简要流程」步骤条同级紧凑（不得使用显著偏厚的 `min-height` 拉高条带）。MUST NOT 改回同行 pill/chip 并排布局。

#### Scenario: Stacked compact IO bars on shelf

- **WHEN** 用户在工作流首页查看含输入/产出摘要的卡片
- **THEN** 「输入」与「产出」各占一行全宽矩形条，条高视觉上接近简要流程步骤芯片，而非明显更高的厚条

#### Scenario: Manage card matches shelf IO density

- **WHEN** 用户打开「维护我的工作流」列表
- **THEN** 管理卡输入/产出条与首页货架卡使用同一紧凑垂直节奏
