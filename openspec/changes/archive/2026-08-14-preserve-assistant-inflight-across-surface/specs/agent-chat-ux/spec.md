## ADDED Requirements

### Requirement: Inflight chat survives surface switches

用户在助手回复仍在生成时切换工作台 / 自动化等其它 surface，再回到该 Session 时，系统 MUST 保留该次发送的用户消息与对应助手气泡（含 streaming / 完成后正文）。MUST NOT 因切面 `activateSession` 用空或半持久化磁盘快照覆盖内存对话，导致空白空态或丢失回复。

#### Scenario: Switch to workbench mid-generation then return

- **WHEN** 用户在通用助理发送消息后、回复未完成前切换到工作台，再切回助理同一 Session
- **THEN** 对话区仍显示该用户消息与助手气泡（生成中或已完成）
- **AND** MUST NOT 呈现无消息的启动空态同时保留停止按钮的卡死态

#### Scenario: Stream events apply while off-surface

- **WHEN** 发起 run 的 Session 不在当前 surface，但流事件仍到达渲染进程
- **THEN** 系统仍将该事件应用到该 Session 保活中的助手消息
- **AND** 用户切回该 Session 时可看到累计进度或最终正文

#### Scenario: Completion clears running composer for that run

- **WHEN** 保活 Session 的 run 进入 completed / cancelled / error
- **THEN** 发送按钮恢复为可发送态（非停止）
- **AND** 助手消息不再永久停留在 streaming
