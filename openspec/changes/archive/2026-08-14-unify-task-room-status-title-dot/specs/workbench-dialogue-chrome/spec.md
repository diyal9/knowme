## ADDED Requirements

### Requirement: Dot-joined primary and secondary title

当工作台 task-room 通栏状态栏处于「协作」或「工作流」模式，且存在与主标题不同的副身份文案（专家名、任务目标、运行意图等）时，系统 MUST 将该副文案以中间点 `·` 拼入主标题（形如 `{主标题} · {副标题}`），并 MUST NOT 再以独立灰色 meta 节点并排展示同一副文案。管线服务模式 MAY 继续使用既有 `Daemon 阶段 · {目的}` 标题语法。若无可用副身份，主标题 MUST NOT 出现孤立的 `·`。

#### Scenario: Collaboration joins expert meta with middle dot

- **WHEN** 用户处于专家协作任务房，且顶栏主标题与专家名（或其他副身份）均有值且不相同
- **THEN** `#agentDialogueStatusTitle` 显示 `{主标题} · {副身份}`
- **AND** `#agentDialogueStatusMeta` 隐藏或不展示同一副身份
- **AND** 模式标签仍为「协作」

#### Scenario: Workflow joins intent meta with middle dot

- **WHEN** 用户处于工作流任务房或工作流运行通栏，且存在与工作流短名不同的目标/意图副文案
- **THEN** `#agentDialogueStatusTitle` 显示 `{工作流短名} · {目标或意图}`
- **AND** `#agentDialogueStatusMeta` 隐藏或不展示同一副文案
- **AND** 模式标签仍为「工作流」

#### Scenario: No secondary leaves title without orphan dot

- **WHEN** 协作或工作流通栏仅有主标题、无独立副身份
- **THEN** 标题仅为该主标题
- **AND** 标题文案中不出现单独的 `·` 分隔符

#### Scenario: Pipeline service title grammar unchanged

- **WHEN** 用户处于管线服务 Daemon 审阅通栏
- **THEN** 标题仍可使用 `Daemon 阶段 · {目的}` 语法
- **AND** 模式标签仍为「管线服务」（若当前实现展示模式标签）
