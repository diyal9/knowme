# office-assistant Delta

## MODIFIED Requirements

### Requirement: 今日优先级快捷入口接地事实

系统 MUST 在办公助理空状态「今日优先级」入口引导 Agent 先调用飞书事实 Workflow，再输出 Top3。

#### Scenario: 空状态展示今日优先级

- **GIVEN** `office-partner` 能力包已启用
- **WHEN** 用户处于办公助理且无对话内容
- **THEN** 空状态 MUST 包含「今日优先级」入口（`feishu-today-priority` / `todayPriority`）
- **AND** 点击后意图 MUST 要求调用 `feishu.today_priority`

#### Scenario: 点击后先拉事实再排序

- **GIVEN** 用户处于办公助理空状态
- **WHEN** 点击「今日优先级」
- **THEN** 系统发送的意图 MUST 要求调用 `feishu.today_priority`
- **AND** MUST NOT 默认要求用户先填截止时间、影响范围、当前阻塞三项
- **AND** 事实足够时立刻给出最多 3 件事（每项含优先级理由、预计耗时、第一步动作）
- **AND** 仅在事实不足时最多追问 1 句
