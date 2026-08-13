## Purpose

管线任务执行间：左过程对话、右审阅制品；运行身份区须展示可读的短目的标题。

## ADDED Requirements

### Requirement: Daemon 目的标题

管线（Daemon）任务进入执行间时，运行身份区 MUST 展示形如 `Daemon 阶段 · {目的标题}` 的短标题。目的标题 MUST 由用户输入意图提炼而来（优先 LLM；不可用时 MUST 使用本地 compact 摘要或工作流名），MUST NOT 将整段 URL 或超长 intent 作为主标题。

#### Scenario: 有输入意图时展示提炼标题

- **WHEN** 用户打开一条带非空 intent 的 Daemon 任务执行间
- **THEN** 身份区可见以 `Daemon 阶段 ·` 开头的标题
- **AND** 标题正文为短可读摘要（非整段粘贴 intent）

#### Scenario: LLM 不可用时本地回退

- **WHEN** LLM 提炼失败或未配置 API
- **THEN** 仍展示 `Daemon 阶段 ·` + 本地 compact / 工作流名
- **AND** 不阻塞任务轮询与审阅 Tab

#### Scenario: 标题提炼不阻断启动

- **WHEN** 用户提交 Daemon 任务且标题仍在异步提炼
- **THEN** 任务仍可创建并进入轮询
- **AND** 标题就绪后身份区更新为提炼结果
