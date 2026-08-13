## MODIFIED Requirements

### Requirement: Shelf card opens a workflow dialogue workbench

用户点击货架卡片空白区域、按 Enter/Space，或点击页脚「开始任务」图标时，系统 MUST 打开工作台双栏工作流对话房：左侧为 package 起点专家的真实对话 Session，右侧为工作流信息与属性操作。系统 MUST NOT 以居中详情弹层或表单「确认输入」作为该主路径。找不到可对话专家时 MUST 提示原因并留在货架。

#### Scenario: Open dialogue from card body

- **WHEN** 用户点击某张货架卡片的空白区域（非编辑/复制等次要按钮）
- **THEN** 系统进入 task-room 布局的工作流对话房
- **AND** 不打开 `workflow-detail` 居中弹层
- **AND** 不进入表单式「填写本次信息」阶段

#### Scenario: Open dialogue from run icon or keyboard

- **WHEN** 用户点击页脚 play「开始任务」，或焦点在卡片上按 Enter/Space
- **THEN** 系统进入与点卡片空白区相同的工作流对话房

#### Scenario: Missing primary expert

- **WHEN** 工作流 package 无法解析出可对话的起点专家
- **THEN** 系统提示缺少专家
- **AND** 用户仍停留在工作流货架

### Requirement: Workflow dialogue right rail shows package context

工作流对话房右侧 MUST 展示工作流导向信息：展示短名、简介或能力说明、需要的输入、预期产出、协作步骤/专家、可运行性或缺失项，以及连接器/技能/知识等属性。右栏 MAY 提供次要「开始运行」进入既有跑批确认输入；该动作 MUST NOT 替代对话房主入口。

#### Scenario: Right rail projects workflow I/O and steps

- **WHEN** 用户从货架打开工作流对话房
- **THEN** 右侧可见该工作流的需要/产出与协作步骤信息
- **AND** 左侧为起点专家对话，Composer 目标草稿不自动发送

#### Scenario: Secondary run action

- **WHEN** 用户在右栏触发「开始运行」且工作流可运行
- **THEN** 系统可进入既有 `beginWorkflowRun` 确认输入路径
- **AND** 不打开编排 Studio

### Requirement: Shelf card footer actions are right-aligned icon buttons

货架卡片页脚 MUST 在右侧展示图标操作；运行入口为 play 图标并带可访问名称「开始任务」。点击运行图标 MUST 进入工作流对话房；编辑/复制 MUST 只触发对应动作且不打开对话房。

#### Scenario: Run control opens dialogue room

- **WHEN** 用户查看并点击 play 图标
- **THEN** 进入工作流对话房
- **AND** 不为绿色「开始」文字按钮

#### Scenario: Secondary action clicks do not open dialogue

- **WHEN** 用户点击编辑或复制等次要图标
- **THEN** 系统执行对应动作
- **AND** 不打开工作流对话房
