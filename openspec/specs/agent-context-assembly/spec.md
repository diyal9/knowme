# agent-context-assembly Specification

## Purpose

定义 Agent 对话（`ai-generate`）在发起模型请求前的意图分级上下文装配与知识检索缓存行为，使闲聊轻量、干活带料。

## Requirements

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

### Requirement: Session capability snapshot in assembly

当 Session 存在 capability snapshot 时，context assembly MUST 仅使用快照中记录的 skill/connector 绑定集合过滤可用能力。

#### Scenario: Snapshot filters skills

- **WHEN** Session 快照绑定 skills [A,B] 但全局 enabled 含 C
- **THEN** 装配与 list_skills 均不含 C

### Requirement: Cached knowledge retrieval

wiki 检索与知识/技能/记忆装配 MUST 使用进程内缓存以避免同一请求周期内重复全量读盘；缓存 MUST 在源文件 mtime 变更或发生写操作（ingest / 概念写入 / 记忆写入）后失效；缓存 miss 或异常时 MUST 回退到直接读盘，结果 MUST 与无缓存时一致。

#### Scenario: Repeated query reuses cache

- **WHEN** 连续两次对未变更的 wiki 内容执行检索
- **THEN** 第二次 MUST NOT 重复读取同一文件全文，且返回命中与首次一致

#### Scenario: Modified file invalidates cache

- **WHEN** 某 wiki/知识文件在两次装配之间被修改（mtime 变化）
- **THEN** 下一次装配 SHALL 重新读取该文件最新内容

### Requirement: 统一本轮生效个性化包

系统 SHALL 为每轮生成产出统一的 Effective Personalization Packet，供普通对话与快捷入口复用。

#### Scenario: 包内仅含可信个性化信号

- **WHEN** 构建本轮个性化包
- **THEN** 仅包含用户手填协作偏好与已确认习惯
- **AND** 设置中的关于我/行业仍可通过 system 用户画像注入
- **AND** MUST NOT 把未确认的 telemetry 当作偏好

#### Scenario: 普通对话与快捷入口同源

- **WHEN** 用户通过快捷入口或普通输入发送
- **THEN** 两者使用同一套个性化摘要逻辑，不得各自拼装互相冲突的协作提示

### Requirement: 轻对话保留短偏好摘要

`chat` tier SHALL 注入严格限长的已确认偏好摘要，使最常见对话路径也能静默沿用习惯。

#### Scenario: chat 仍带偏好

- **WHEN** 用户在普通聊天发送消息且存在已确认习惯或手填偏好
- **THEN** 请求中 SHALL 包含限长个性化摘要（默认不超过 4 条）

#### Scenario: 预算裁剪可解释

- **WHEN** 条数上限导致部分习惯未注入
- **THEN** 个性化包 SHALL 记录被裁掉的条目或原因，供 UI 解释
