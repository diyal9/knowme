# agent-workbench (delta)

## MODIFIED Requirements

### Requirement: 工作台一级导航

工作台顶栏 SHALL 提供「任务 / 工作流 / Daemon」三个平级 Tab，默认停在「任务」。运行页与编排页为带返回入口的全屏页，此时三 Tab 隐藏。搜索框仅在「工作流」Tab 显示。

#### Scenario: 默认进入任务首页

- **WHEN** 用户进入工作台
- **THEN** 顶栏显示「任务 / 工作流 / Daemon」三 Tab，且停在「任务」
- **AND** 顶栏不再有「管理」下拉或右滑抽屉

#### Scenario: 切换 Tab

- **WHEN** 用户点击「工作流」Tab
- **THEN** 展示货架 surface，且顶栏搜索框出现
- **WHEN** 用户点击「Daemon」Tab
- **THEN** 展示执行后端面（连接状态 / 只读专家阵容 / 任务监控），搜索框隐藏

### Requirement: 术语统一为「专家」

工作台与助手侧的用户可见文案 SHALL 使用「专家」指代 KnowMe 规则下的 Agent 实体；系统技术名（`Agent Graph`、`Agent Run`）与代码标识符（`agentId`、`agent-runs/`、IPC channel、CSS 类名）保持不变。

#### Scenario: 编排页专家措辞

- **WHEN** 用户进入编排工作流页
- **THEN** 界面显示「可用专家 / 选择专家 / 拖入专家」等措辞，不出现「智能体」

## ADDED Requirements

### Requirement: 任务首页与持久化

工作台「任务」Tab SHALL 提供快捷任务入口与最近任务列表，任务经独立存储持久化，重启后仍可见。用户可选择一位专家并描述目标以创建任务并触发执行。

#### Scenario: 安排专家执行任务

- **WHEN** 用户在任务首页点击某位专家的快捷卡片或「新建任务」
- **THEN** 打开 composer，可选择专家并填写任务目标
- **WHEN** 用户提交且专家与目标均非空
- **THEN** 创建一条持久化任务并触发单专家执行
- **AND** 该任务出现在最近任务列表，带状态与相对时间

#### Scenario: 无可用专家

- **WHEN** 任务首页没有可用专家
- **THEN** 快捷区给出去能力界面创建 / 安装专家的提示

#### Scenario: 重启后任务仍在

- **WHEN** 用户创建任务后重启客户端并回到任务首页
- **THEN** 最近任务列表仍展示该任务

### Requirement: 工作流管理入口

「工作流」Tab 的货架 SHALL 提供进入「我的工作流管理」的入口，管理子页支持新建 / 我的列表 / 删除，并可返回货架。

#### Scenario: 从货架进入并返回管理

- **WHEN** 用户在货架点击「管理我的工作流」
- **THEN** 进入工作流管理子页（新建 / 我的列表 / 删除）
- **WHEN** 用户点击「返回」
- **THEN** 回到货架
