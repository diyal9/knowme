## Purpose

让协作 / 工作流 / Daemon 等任务在需要用户关注时，按 KnowMe 是否在前台分流到 FAB 通知或桌面级提示窗，避免漏掉授权与输入。

## ADDED Requirements

### Requirement: Task attention routes by app focus

系统 MUST 将任务待关注事件按 KnowMe 工作台是否在前台分流：前台走悬浮铃铛通知面；后台 MUST 弹出桌面级提示窗。需用户授权或输入的事件 MUST 标记为 input 紧急度。

#### Scenario: Foreground in-app notification

- **WHEN** KnowMe 工作台可见且聚焦，且某 Daemon/工作流/协作任务需要关注且当前焦点不在该任务处理面
- **THEN** 系统 SHALL 在悬浮铃铛面板展示对应通知条目
- **AND** MUST NOT 因该事件弹出桌面级提示窗

#### Scenario: Background desktop toast

- **WHEN** KnowMe 工作台不可见或不聚焦，且出现需关注事件
- **THEN** 系统 SHALL 弹出桌面级暗色提示窗（含标题与正文，可关闭）
- **AND** 用户点击提示窗 SHALL 显示并聚焦工作台

### Requirement: Input urgency animates the bell until opened

需用户授权或输入的待关注事件 MUST 驱动铃铛间歇动画；用户点击铃铛打开通知面板后 MUST 停止动画。

#### Scenario: Pulse until FAB open

- **WHEN** 存在 input 紧急度的未处理通知
- **THEN** 铃铛 SHALL 呈现间歇动画并显示状态红点
- **AND WHEN** 用户点击铃铛打开面板
- **THEN** 间歇动画 SHALL 停止

#### Scenario: Clear when attention resolved

- **WHEN** 对应 HITL/等待已解除
- **THEN** 系统 SHALL 清除该通知条目
- **AND** 若无其它 input 通知，红点与动画 SHALL 关闭
