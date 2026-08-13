## MODIFIED Requirements

### Requirement: Workflow dialogue right rail shows package context

工作流对话房右侧 MUST 展示工作流导向信息：展示短名、简介或能力说明、需要的输入、预期产出、协作步骤/专家、可运行性或缺失项，以及连接器/技能/知识等属性。简介、需要、产出、协作步骤之间 MUST 有清晰段落或分隔线。「需要」「产出」MUST 以清单（列表）展示，MUST NOT 仅用胶囊标签云作为唯一形态。右栏 MUST NOT 提供「开始运行」作为对话房内 CTA；推进工作流 MUST 以左侧对话为主路径。

#### Scenario: Right rail projects workflow I/O and steps as lists

- **WHEN** 用户从货架打开工作流对话房
- **THEN** 右侧可见该工作流的需要/产出清单与协作步骤信息
- **AND** 各信息块之间段落清晰或有分隔
- **AND** 左侧为起点专家对话，Composer 目标草稿不自动发送

#### Scenario: No secondary run button in dialogue rail

- **WHEN** 用户查看工作流对话房右栏
- **THEN** 不出现「开始运行」按钮
- **AND** 不出现引导用户去点「开始运行」的就绪文案
