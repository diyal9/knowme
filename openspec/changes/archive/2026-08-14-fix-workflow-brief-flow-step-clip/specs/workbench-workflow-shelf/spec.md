## ADDED Requirements

### Requirement: Brief flow step labels render in full

工作流首页货架卡与维护卡「简要流程」中的步骤标签 MUST 完整展示节点标题，不得因固定过窄的最大宽度裁切末字。步骤区 MAY 折行排布；若单标签仍超出卡片可用宽度，MUST 提供完整文案的悬停提示（`title`）。

#### Scenario: Long gate label is fully readable

- **WHEN** 用户查看「会议闭环」官方卡的简要流程
- **THEN** 「负责人与截止日校验」完整可见，无末字被裁切
