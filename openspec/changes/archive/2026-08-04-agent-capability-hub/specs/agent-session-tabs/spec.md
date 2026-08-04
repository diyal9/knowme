# Delta Spec: agent-session-tabs

## ADDED Requirements

### Requirement: Session binds expert and capability snapshot

Session 数据 MUST 支持 `expertId` 与 `capabilitySnapshotId`（或等价 snapshots 路径）。新建 Session 时 MAY 选择专家；选择后 MUST 冻结 capability 版本快照。

#### Scenario: New session with expert picker

- **WHEN** 用户点击 `+` 新建 Session
- **THEN** MAY 弹出专家选择（可跳过为通用 Agent）
- **AND** 选择专家后写入 expertId 并创建 snapshot

#### Scenario: Tab shows expert indicator

- **WHEN** Session 绑定专家
- **THEN** Tab 标题或副标展示专家名称

#### Scenario: Snapshot survives tab switch

- **WHEN** 用户在多 Tab 间切换
- **THEN** 各 Session 使用各自 snapshot，expert persona 与工具集不串线

### Requirement: Ephemeral try-chat sessions excluded from main tabs

专家 Hub「试聊」产生的 ephemeral Session MUST NOT 出现在常开 Tab 列表；关闭试聊 MUST 清理 ephemeral 数据。

#### Scenario: Try-chat not in tab bar

- **WHEN** 用户从 Hub 试聊专家
- **THEN** 试聊 UI 独立展示，主 Tab 栏不新增持久 Tab

### Requirement: Persistence includes expert binding

Session 持久化 MUST 包含 `expertId` 与 snapshot 引用；重启后 MUST 恢复 openSessionIds、activeSessionId 与各 Session 的专家绑定。

#### Scenario: Restart restores expert session

- **WHEN** 用户重启工作台
- **THEN** 恢复 openSessionIds、activeSessionId 与各 Session 的 expertId 与 snapshot 引用

#### Scenario: Restart keeps snapshot persona

- **WHEN** 重启前 Session S 绑定专家且存在 snapshot
- **THEN** 重启后 Session S 继续使用同一 snapshot persona
