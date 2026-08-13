## ADDED Requirements

### Requirement: Workbench header presents one integrated mode context

工作台头部 MUST 将“工作模式”语义和当前模式整合为单一可聚焦控件，并 MUST 将该控件与“总览 / 团队 / 工作流”页面导航呈现为两个可区分但连续的分组。

#### Scenario: User identifies current context

- **WHEN** 用户进入工作台任一非任务工作间页面
- **THEN** 头部在一个整合控件内同时显示“工作模式”语义和当前模式名称
- **AND** “总览 / 团队 / 工作流”继续以扁平标签显示当前页面
- **AND** 头部不再在模式控件外重复显示独立的“工作模式”文字

#### Scenario: User changes mode or page with keyboard

- **WHEN** 用户通过键盘聚焦模式控件或页面标签
- **THEN** 控件 MUST 显示清晰焦点反馈
- **AND** 模式切换与页面切换行为 MUST 与优化前一致

#### Scenario: Header is rendered in a narrow window

- **WHEN** 工作台可用宽度收窄
- **THEN** 模式控件和页面标签 MUST 保持可见且可操作
- **AND** 头部 MUST NOT 出现横向遮挡或溢出窗口

### Requirement: Empty workflow state provides a next action

当当前模式没有可用工作流时，工作台 MUST 以紧凑引导卡说明当前状态，并 MUST 提供能够继续配置的直接操作。

#### Scenario: Non-engineering mode has no workflow

- **WHEN** 用户在日常办公或视觉创作模式进入“工作流”且没有可用工作流
- **THEN** 页面 MUST 使用当前模式名称解释尚未接通工作流
- **AND** 页面 MUST 提供进入专业能力安装入口的主操作
- **AND** 页面 MUST 提供进入 Agent 添加入口的次操作

#### Scenario: Empty state is used with keyboard

- **WHEN** 用户使用键盘操作空状态
- **THEN** 两个操作 MUST 可聚焦、可触发并显示明确焦点反馈

#### Scenario: Empty state uses available space

- **WHEN** 工作流目录为空
- **THEN** 引导卡 MUST 采用紧凑高度并保持正文与操作相邻
- **AND** 页面 MUST NOT 保留模拟完整工作流目录的大面积无信息留白

### Requirement: Recent runs disclose cross-mode context and recovery path

工作台 MUST 在非研发模式展示研发任务记录时明确披露跨模式来源，并 MUST 让失败任务的打开结果可被用户预期。

#### Scenario: User views engineering history from another mode

- **WHEN** 当前模式不是软件研发且最近运行包含研发任务
- **THEN** 最近运行标题区 MUST 明确说明这些记录来自软件研发
- **AND** 每条任务 MUST 继续显示其来源模式

#### Scenario: User views a failed run

- **WHEN** 最近运行中的任务状态为失败
- **THEN** 任务入口 MUST 使用“查看详情”类文案说明点击后的恢复路径
- **AND** 激活任务入口 MUST 打开既有任务详情，不改变任务运行协议
