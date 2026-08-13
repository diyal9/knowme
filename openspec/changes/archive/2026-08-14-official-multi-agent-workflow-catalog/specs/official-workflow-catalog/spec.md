## ADDED Requirements

### Requirement: Official multi-agent reference workflows on the shelf

系统 MUST 向工作流货架提供恰好三条官方参考工作流 Package（办公会议闭环、研发三角色交付、视觉 Brief 审阅导出），且每条 MUST 满足：`source` 为 `official`、包含 ≥2 个不同 `agentPackageId` 的 agent 节点、≥1 个 gate 节点、以及可连到 terminal 的 edges。系统 MUST NOT 将无 graph / 无 Agent 的空壳 Demo 种子作为官方条目上架。

#### Scenario: Three official cards visible

- **WHEN** 用户打开工作台「工作流」货架且官方目录启用
- **THEN** 可见三条 `source=official` 卡片，分别可归入办公、研发、视觉领域筛选

#### Scenario: Multi-agent and gate structure

- **WHEN** 客户端读取任一官方 Package 的 graph
- **THEN** agent 节点引用至少两个不同专家 id，且存在至少一个 `type=gate` 节点

#### Scenario: Runnable via local-team graph

- **WHEN** 官方包依赖专家已安装且 local-team 启用，用户确认目标后启动
- **THEN** 系统使用 local-team / Agent Graph 路径执行（不得因缺少 Daemon 而不可用）

### Requirement: Official workflow experts are ensurable

系统 MUST 为官方工作流声明依赖专家集合，并在工作台加载时幂等确保 curated 专家可安装启用；缺失依赖时 readiness MUST 给出可安装类 blocker，而不是静默不可用。

#### Scenario: Missing expert surfaces install blocker

- **WHEN** 某官方包引用的专家未安装
- **THEN** 该包 readiness.runnable 为 false，且 blockers 含 missing-agent 与对应 agentId
