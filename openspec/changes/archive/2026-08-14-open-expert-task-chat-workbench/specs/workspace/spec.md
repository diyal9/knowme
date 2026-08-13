## ADDED Requirements

### Requirement: Single-expert task opens an embedded conversation room

工作台通过“安排专家执行任务”创建单专家任务时，系统 MUST 创建并激活所选专家的持久对话 Session，并 MUST 在工作台任务工作间展开该对话。系统 MUST NOT 为此路径弹出 Agent Graph 计划确认或自动启动团队编排。

#### Scenario: Create and start an expert task

- **WHEN** 用户选择专家、填写任务目标、选择知识库并点击“创建并开始”
- **THEN** 工作台进入左右任务工作间并显示所选专家的对话
- **AND** 对话输入框预填任务目标但不自动发送
- **AND** 不出现 Agent Graph 二次确认层

#### Scenario: Reopen a recent expert task

- **WHEN** 用户从最近任务打开一个已绑定专家 Session 的任务
- **THEN** 工作台恢复同一 Session、任务目标与知识库范围
- **AND** 不创建重复 Session 或重复任务

#### Scenario: Start expert conversation from workbench surface

- **WHEN** 用户从工作台专家详情（surface=workbench）点击开始对话
- **THEN** 系统创建工作台任务并绑定专家 Session（execRef.kind=session）
- **AND** 在工作台 task-room 展开对话，而不是切入助理表面
- **AND** 关闭后该任务仍出现在最近任务并可再次打开

#### Scenario: Session creation fails

- **WHEN** 专家 Session 因专家缺失、数据损坏或运行时错误创建失败
- **THEN** 工作台保留任务草稿中的专家、目标和知识库选择
- **AND** 不将任务标记为进行中
- **AND** 向用户显示一条可操作的失败提示
