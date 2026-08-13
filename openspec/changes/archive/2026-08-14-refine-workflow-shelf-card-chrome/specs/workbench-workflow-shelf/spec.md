## ADDED Requirements

### Requirement: Shelf card chrome is refined without losing scan answers

货架工作流卡片 MUST 以更低噪音的 chrome 呈现：输入/产出摘要为软底 chip（MUST NOT 依赖硬描边作为唯一分区），步骤数与最近更新时间 MUST 出现在页脚 meta 区，开始任务按钮 MUST 相对编辑/复制有主次视觉区分，且不同领域 MUST 使用可区分的图标井符号。卡片 MUST 仍在不展开时回答：产出什么、需要什么、现在能不能跑。

#### Scenario: Soft meta chips without hard border stack

- **WHEN** 用户浏览货架工作流卡片
- **THEN** 输入与产出以软底 chip 显示，且不与卡片边框形成多层硬描边墙

#### Scenario: Footer carries steps and updated time

- **WHEN** 卡片有有效时间戳与步骤数
- **THEN** 页脚左侧显示步骤与相对更新时间，右侧操作按钮主次分明

#### Scenario: Domain mark is distinguishable

- **WHEN** 货架同时存在办公、研发、视觉领域工作流
- **THEN** 各卡片图标井使用可区分的领域符号（而非全部同一通用 workflow 图标）
