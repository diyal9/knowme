## ADDED Requirements

### Requirement: 运行面返回按来源回到一级导航

工作台从「任务」「工作流」或「管线服务」进入运行审阅 / 任务工作间后，用户激活「返回」（含顶栏 `#wbRunBack`、审阅底栏返回、结果页返回）时，系统 MUST 回到进入前所在的一级面，MUST NOT 一律落到工作流货架。

#### Scenario: 从管线服务打开任务后返回

- **WHEN** 用户在管线服务面板打开某 daemon 任务进入运行审阅
- **AND** 用户点击返回
- **THEN** 工作台 SHALL 显示管线服务面板（`manage` + `daemon`），且管线服务 Tab 为选中态

#### Scenario: 从工作流货架进入运行后返回

- **WHEN** 用户从工作流货架启动或恢复工作流运行
- **AND** 用户点击返回
- **THEN** 工作台 SHALL 显示工作流货架（`shelf`）

#### Scenario: 从任务首页进入专家任务房后返回

- **WHEN** 用户从任务首页打开专家任务房
- **AND** 用户点击返回
- **THEN** 工作台 SHALL 显示任务首页（`taskhome`）

#### Scenario: 从货架打开工作流对话房后返回

- **WHEN** 用户从工作流货架打开工作流对话房
- **AND** 用户关闭 / 返回该任务房
- **THEN** 工作台 SHALL 显示工作流货架，MUST NOT 落到任务首页

### Requirement: Daemon 与工作流返回入口行为一致

Daemon 运行审阅底栏的「返回」动作 MUST 与顶栏返回使用同一套来源恢复逻辑（不得仅清空 run 而停留在空运行面或误跳货架）。

#### Scenario: Daemon 底栏返回与顶栏一致

- **WHEN** 用户从管线服务进入 daemon 运行审阅
- **AND** 用户点击审阅底栏「返回」
- **THEN** 行为 SHALL 与点击顶栏「返回」相同，回到管线服务
