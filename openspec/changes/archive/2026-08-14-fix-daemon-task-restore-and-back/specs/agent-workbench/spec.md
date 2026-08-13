## ADDED Requirements

### Requirement: 冷启动不强制打开失效 Daemon 任务房

工作台加载时，系统 MUST NOT 因本地草稿中的无效或已结束 Daemon slug 自动进入运行审阅。仅当任务仍可恢复（非终态，且管线离线或 slug 仍出现在管线任务列表）时，才可静默打开任务房。

#### Scenario: 已清除任务的草稿不自动恢复

- **WHEN** 本地 `taskDraft.slug` 指向管线任务列表中不存在的任务，且管线在线
- **AND** 用户新启动 KnowMe 并进入工作台
- **THEN** 系统 SHALL 停留在概览一级面，MUST NOT 自动打开该 Daemon 任务房
- **AND** SHALL 清理该失效草稿，避免下次启动再次弹出

#### Scenario: 进行中且仍存在的任务可静默恢复

- **WHEN** 本地草稿指向仍在管线任务列表中的进行中任务
- **AND** 用户新启动 KnowMe 并进入工作台
- **THEN** 系统 MAY 静默恢复该任务房
- **AND** 用户点击返回时 SHALL 回到管线服务（除非草稿显式记录了其它来源面）

### Requirement: Daemon 运行面返回立即离开且来源正确

用户从 Daemon 任务房激活「返回」时，系统 MUST 先离开运行面并恢复一级导航，MUST NOT 先阻塞等待完整目录刷新；无显式来源时 Daemon 任务 MUST 回到管线服务，MUST NOT 落到专家协作（任务首页）。

#### Scenario: 返回不因目录刷新卡顿

- **WHEN** 用户在 Daemon 任务房点击返回
- **THEN** 工作台 SHALL 立即切换到对应一级面
- **AND** 目录刷新 MAY 在后台进行，MUST NOT 阻塞本次导航

#### Scenario: 无显式来源的 Daemon 恢复后返回管线

- **WHEN** 冷启动或草稿恢复打开 Daemon 任务且未记录其它 `returnState.surface`
- **AND** 用户点击返回
- **THEN** 工作台 SHALL 显示管线服务面板，MUST NOT 显示专家协作任务首页
