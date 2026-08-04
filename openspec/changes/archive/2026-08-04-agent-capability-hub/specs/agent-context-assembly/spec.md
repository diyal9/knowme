# Delta Spec: agent-context-assembly

## MODIFIED Requirements

### Requirement: Intent-tiered context assembly

Agent 对话（`ai-generate`）在发起模型请求前 MUST 依据本地启发式意图判定选择上下文装配层级（`chat` / `assist` / `retrieval`），MUST NOT 对所有消息一律装配全量知识/技能/检索上下文。判定 MUST NOT 依赖额外的模型/网络调用。判定异常时 MUST 回退到 `assist`（不丢能力）。装配 MUST 纳入 **Expert persona**（session 快照）与 **Skill 自动匹配 L0 摘要**。

#### Scenario: Greeting stays lightweight

- **WHEN** 无打开文件正文、无 `/` 技能引用、无 `@` 引用，且消息为问候/致谢/极短闲聊（如「你好」「什么」）
- **THEN** 装配的上下文 MUST NOT 含 wiki 检索结果，也 MUST NOT 含技能包正文；仅含底座人格、用户偏好、Expert persona（若绑定）与近期历史

#### Scenario: Work request brings context

- **WHEN** 消息含工作动词（总结/整理/润色/改写/翻译/拆解/校对等）或存在打开文件正文
- **THEN** 装配的上下文 SHALL 含知识库摘要、Skill 自动匹配 L0 摘要与相关技能包

#### Scenario: Retrieval intent queries wiki

- **WHEN** 会话角色为 steward，或消息含明确知识检索意图（查/找/依据知识库/我的笔记等），或含 `/` 技能 / `@` 引用
- **THEN** 装配 SHALL 执行 wiki 检索并将命中结果并入上下文

#### Scenario: Full-context override

- **WHEN** 用户显式开启全量上下文开关（设置或环境变量）
- **THEN** 无论意图层级，装配 SHALL 走全量路径（等价改造前行为）

#### Scenario: Expert persona from session snapshot

- **WHEN** Session 绑定 expertId 且存在 snapshots/<sessionId>/
- **THEN** 装配使用快照内 expert systemPrompt，而非 Hub 最新编辑版本

#### Scenario: Skill auto-match respects disable flag

- **WHEN** 某 SKILL.md 技能设 disable-model-invocation: true
- **THEN** 自动匹配 MUST NOT 注入该技能，除非用户 `/slash` 显式选用

## ADDED Requirements

### Requirement: Session capability snapshot in assembly

当 Session 存在 capability snapshot 时，context assembly MUST 仅使用快照中记录的 skill/connector 绑定集合过滤可用能力。

#### Scenario: Snapshot filters skills

- **WHEN** Session 快照绑定 skills [A,B] 但全局 enabled 含 C
- **THEN** 装配与 list_skills 均不含 C
