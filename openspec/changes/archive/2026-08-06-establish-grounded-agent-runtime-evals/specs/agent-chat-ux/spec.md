## ADDED Requirements

### Requirement: Honest read and verify status in assistant surface

助手气泡区域 MUST 诚实展示读取/验证状态与来源：verified、pending、blocked、failed。MUST NOT 在无 ToolLedger ok 与 verified claims 时展示「已读取」「已同步」等绿色成功态徽章或等价误导文案。

#### Scenario: No false read badge without ledger

- **WHEN** 助手输出总结但 ToolLedger 无 required read ok
- **THEN** UI MUST NOT 显示「已读取」成功徽章
- **AND** MUST 显示 pending 或 blocked 说明

#### Scenario: Verified summary shows sources affordance

- **WHEN** claims 通过 verifier 且含 evidenceIds
- **THEN** 助手气泡 MUST 提供「查看来源」或等价入口
- **AND** 来源列表 MUST 与 ledger provenance 一致

#### Scenario: Blocked output shows next step not fake facts

- **WHEN** OutputGate blocked 编造事实
- **THEN** 用户可见文案 MUST 说明需先调用何工具或澄清何选项
- **AND** MUST NOT 同时展示编造议题/日期/责任人

### Requirement: Structured selection UI aligns with ReferenceState

当展示候选列表（会议、文档等）时，UI MUST 与 ReferenceState pendingSelection 同步；用户点选或回复序号 MUST 走 structured binding 路径。

#### Scenario: Click candidate binds ref without NL-only path

- **WHEN** 用户点击候选卡片或发送序号
- **THEN** 系统 MUST 更新 ReferenceState 绑定
- **AND** MUST NOT 仅把「2」作为裸 prompt 传给模型而无 binding 事件
