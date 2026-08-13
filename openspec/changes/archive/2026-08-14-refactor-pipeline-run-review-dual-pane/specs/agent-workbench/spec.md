## MODIFIED Requirements

### Requirement: Daemon 运行审阅优先

打开管线任务执行间时，右侧 SHALL 以审阅制品（步骤/制品/变更/事件）为主表面，不得再以冗长状态卡 + 任务追溯堆叠作为 daemon 默认主视图。左侧对话区 SHALL 承载过程（progress/logs）投影。

#### Scenario: 默认强调步骤与制品

- **WHEN** 用户查看 Daemon 管线任务执行间
- **THEN** 右侧可见审阅 Tab 与推荐条
- **AND** 过程日志不在右侧抢占主视觉（过程在左侧对话流）

#### Scenario: 过程日志入口

- **WHEN** 用户在审阅面点击「查看过程日志」
- **THEN** 系统聚焦左侧过程日志区域
