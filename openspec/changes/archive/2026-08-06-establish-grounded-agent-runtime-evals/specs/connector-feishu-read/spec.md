## ADDED Requirements

### Requirement: Connector outputs bind to ReferenceState

Feishu read connector（及等价 read workflow）在返回候选列表时 MUST 写入 ReferenceState pendingSelection/options，payload MUST 含后续 read tool 所需定位字段（如 minute_token 或 url）。MUST NOT 仅输出 Markdown 列表供下轮 NL 猜序号。

#### Scenario: Meeting candidates write structured options

- **WHEN** 系统返回最近会议候选
- **THEN** ReferenceState MUST 含 pendingSelection.options，每项含 id、展示 label、minute_token（或 url）
- **AND** 与 UI 单卡片展示一致

#### Scenario: Selection triggers meeting_read not read_doc

- **WHEN** 用户通过 structured binding 选择会议候选
- **THEN** runtime MUST 改写为 `feishu.meeting_read` intent
- **AND** MUST NOT 改写为 `feishu.read_doc`

### Requirement: Read success does not bypass ledger verification

即使 `feishu.meeting_read` 成功，具体议题/责任人/日期 MUST 仅来自 ledger 中 ok 正文 evidence；connector MUST 标记 truncated/empty 结果供 runtime 使用。

#### Scenario: Empty minute body marked insufficient

- **WHEN** meeting_read 返回无实质正文
- **THEN** tool result MUST 含 structured insufficient/truncated 信号
- **AND** 下游 MUST NOT 输出结构化议题/待办
