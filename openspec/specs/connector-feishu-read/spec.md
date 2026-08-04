# connector-feishu-read Specification

## Purpose
TBD - created by archiving change connector-feishu-read. Update Purpose after archive.
## Requirements
### Requirement: Read tools are allowlisted

Feishu read tools MUST only be available when the feishu connector is enabled and each tool name is present in the connector allowlist.

#### Scenario: Search docs

- **WHEN** `feishu.search_docs` is allowlisted and the model calls it with a non-empty query
- **THEN** the main process runs the allowlisted `docs +search` CLI invocation and returns truncated text

#### Scenario: Unknown CLI surface

- **WHEN** a caller attempts an arbitrary Feishu CLI command not in the read map
- **THEN** the connector rejects it as a non-read tool

### Requirement: No writes in read Story path

Read tool execution MUST NOT invoke create/update/delete Feishu APIs.

#### Scenario: Tool table

- **WHEN** only read tools are allowlisted
- **THEN** `feishu.draft_write_doc` is absent from Agent tool definitions

### Requirement: 选序号后必须用 meeting_read 读妙记

系统 MUST 在会议候选场景中以单卡片展示会议，并在用户回复序号后调用 `feishu.meeting_read` 读取妙记；失败时给出真实原因，成功时输出结构化分析。

#### Scenario: 候选会议以单卡片展示

- **WHEN** 系统返回最近会议候选
- **THEN** 每场会议只显示一张可打开的飞书妙记卡片
- **AND** 会议标题、日期时间和组织者均展示在卡片内部，卡片外不残留独立标题或项目符号
- **AND** 不得把 `minute_token` 或原始 `url` 作为额外可见列表项或重复卡片展示
- **AND** 系统仍可从该卡片链接解析定位信息，支持用户回复序号继续读取

#### Scenario: 回复候选序号

- **WHEN** 上一轮助手消息含会议候选，且用户回复纯序号（如「2」）
- **THEN** 系统改写提示为调用 `feishu.meeting_read`，并带上对应 `minute_token`（或 url）
- **AND** 不得改写为 `feishu.read_doc`

#### Scenario: 读取失败必须给出真实原因

- **WHEN** `feishu.meeting_read` 返回失败
- **THEN** 助手输出必须带上工具返回的真实失败原因，不得只说「读取未成功，请核对链接/token 与权限」
- **AND** 若失败原因是这份妙记没有查看权限，必须说明是该妙记 ACL 而非应用 scope 缺失，并给出「回复申请妙记权限」的下一步
- **AND** 用户回复简短的「申请妙记权限」时，系统改写为调用 `feishu.draft_minute_permission`，并要求先展示申请内容、经用户确认后才发送

#### Scenario: 读取成功后的输出结构

- **WHEN** `feishu.meeting_read` 返回可读妙记正文
- **THEN** 助手输出至少包含：议题、结论、待办（责任人/时间点如有）、以及「简要分析」
- **AND** 简要分析覆盖：对我相关的事项、风险/阻塞、建议下一步
- **AND** 不得编造正文中未出现的事实

### Requirement: 今日优先级 Workflow

系统 MUST 提供确定性只读工具 `feishu.today_priority`，汇总授权用户今日日程与未完成待办，供优先级判断 grounding。

#### Scenario: 拉取今日日程与待办

- **WHEN** Agent 调用 `feishu.today_priority`
- **THEN** 系统用 `calendar +agenda` 读取今天日程
- **AND** 用 `task +get-my-tasks --complete=false` 读取未完成待办（可带 due 上界）
- **AND** 返回可读事实摘要，不写入飞书、不发送消息

#### Scenario: 可选今日 @我 信号

- **WHEN** Workflow 执行且 IM 权限可用
- **THEN** 可用 `im +messages-search --is-at-me` 附加今日 @我 条数或摘要作为阻塞信号
- **AND** IM 失败 MUST NOT 导致整个 Workflow 失败（降级为仅日程+待办）

#### Scenario: grounding 不误判为文档读取

- **WHEN** 用户意图为「今日优先级」且 `feishu.today_priority` 已成功返回
- **THEN** 系统 MUST NOT 用「请提供文档链接或 token」替换回答
