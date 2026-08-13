## ADDED Requirements

### Requirement: Activate prefers inflight history for running sessions

激活 Session（含 surface 切换恢复）时，若该 Session 存在进行中的助手 run 且渲染层持有保活对话，系统 MUST 使用保活对话作为当前 `chatHistory`，MUST NOT 仅用磁盘 Session 消息覆盖导致丢失未落盘的 streaming 气泡。

#### Scenario: Surface restore hits inflight session

- **WHEN** `setSurfaceMode` 恢复某 Session 且该 Session 有进行中的 run 保活历史
- **THEN** Tab 激活后对话内容来自保活历史
- **AND** 与切走前为同一逻辑对话（用户消息与助手 run 对齐）

#### Scenario: Idle session still loads from store

- **WHEN** 激活的 Session 没有进行中的 run 保活
- **THEN** 系统仍从 Session 存储加载消息
- **AND** 行为与既有激活路径一致
