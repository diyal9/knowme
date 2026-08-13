## ADDED Requirements

### Requirement: Skill and workflow declare grounding contract

SKILL.md frontmatter 与 Workflow manifest MUST 支持可选字段：`requiredTools`、`requiredEvidence`、`completionConditions`。Runtime 激活 skill/workflow 时 MUST 写入 ReferenceState.taskFrame 并强制执行。

#### Scenario: Required tool enforced at runtime

- **WHEN** skill 声明 `requiredTools: [feishu.meeting_read]`
- **AND** 用户完成结构化选择触发读取流程
- **THEN** runtime MUST 调度该 tool 或 fail-closed
- **AND** MUST NOT 仅依赖 skill body 中的自然语言说明

#### Scenario: Required evidence blocks completion

- **WHEN** `requiredEvidence` 要求 tool_result minChars 且 forbidTruncated
- **AND** 工具返回 truncated/empty
- **THEN** completionConditions MUST NOT 满足
- **AND** skill 不得标记 workflow 完成

#### Scenario: Missing contract keeps legacy behavior

- **WHEN** skill 未声明 grounding 三元组
- **THEN** runtime MUST 保持与改造前等价的宽松行为
- **AND** 不得因缺字段而阻断 unrelated chat

### Requirement: Workflow writes structured refs not NL recovery hints

Skill/Workflow 触发的候选列表（会议、文档、任务等）MUST 通过 ReferenceState pendingSelection 或 refs 写入结构化 payload，MUST NOT 仅依赖助手 Markdown 里的「回复 1/2」文本供下轮 NL 解析。

#### Scenario: Meeting workflow seeds pending selection

- **WHEN** workflow 展示 N 个候选条目
- **THEN** 系统 MUST 写入 pendingSelection.options 含 id、label、payload
- **AND** UI 卡片与 ReferenceState MUST 一致
