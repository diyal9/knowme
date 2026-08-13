## Purpose

保证货架上确实有货：定义工作流从仓库、Daemon 目录与个人存储汇入货架时的完整性契约，确保内容不在投影途中丢失、不把已废弃条目上架、不用悬空引用冒充可用能力。

## ADDED Requirements

### Requirement: Projection preserves executable content

把仓库工作流定义投影为 Workflow Package 时，系统 MUST 保留其可执行内容，包含 `graph.nodes`、`graph.edges` 与 `agentRefs`。投影结果 MUST 能够通过 Workflow Package 校验，MUST NOT 产生仅有名称与元数据的空壳条目。

#### Scenario: Repository workflow keeps its graph

- **WHEN** 仓库中一个工作流定义包含若干执行节点，系统将其投影为 Workflow Package
- **THEN** 该 Package 的节点数量与定义一致，校验不报 graph 缺失

#### Scenario: Empty shell is rejected from the shelf

- **WHEN** 某来源提供的工作流经投影后既无 graph 节点也无 agentRefs
- **THEN** 该条目不上货架，并记入供给诊断，说明它来自哪个来源、缺什么

### Requirement: Daemon catalog joins the shelf

Daemon 在线时，其目录中的工作流 MUST 与本地工作流一同出现在货架上，MUST NOT 只存在于其他页面。Daemon 离线时这些条目 MUST 从货架消失，系统 MUST NOT 以缓存条目伪装其仍然可用。

#### Scenario: Daemon workflows appear on the shelf

- **WHEN** Daemon 在线且目录中含有若干工作流
- **THEN** 这些工作流出现在货架上，与本地工作流使用同一套卡片信息结构

#### Scenario: Daemon offline removes its workflows

- **WHEN** Daemon 从在线转为离线
- **THEN** 来自 Daemon 的工作流从货架移除，系统告知用户连接 Daemon 可恢复这些工作流

#### Scenario: Same workflow from two sources

- **WHEN** 同一个工作流同时来自仓库与 Daemon 目录
- **THEN** 货架只显示一张卡片，且该卡片保留可执行内容最完整的那一份

### Requirement: Deprecated entries never reach the shelf

系统 MUST 在货架上过滤掉标记为废弃或内部使用的工作流，过滤规则 MUST 与执行侧目录接口保持一致。

#### Scenario: Deprecated workflow filtered

- **WHEN** 某工作流在目录中被标记为废弃
- **THEN** 它不出现在货架上，与执行侧接口的可见性判定保持一致

### Requirement: Agent references resolve or are declared missing

工作流引用的 Agent MUST 能解析到实际存在的 Agent。存在历史别名时系统 MUST 归一到实际标识。无法解析时该工作流 MUST 明确标记为未就绪并列出缺失的 Agent，MUST NOT 以可用姿态出现在货架上。

#### Scenario: Alias resolves to the real agent

- **WHEN** 某工作流引用的 Agent 标识是历史别名，而实际存在的是另一个标识
- **THEN** 系统归一到实际存在的 Agent，该工作流的可运行性按实际 Agent 判定

#### Scenario: Missing agent blocks availability

- **WHEN** 某工作流引用的 Agent 在本机与 Daemon 中均不存在
- **THEN** 该工作流标记为未就绪，卡片列出缺失的 Agent 名称，主操作不可用

### Requirement: Supply diagnostics explain an empty shelf

系统 MUST 能给出货架当前供给状况的诊断，说明各来源分别贡献了多少可运行工作流，以及因何种原因排除了哪些条目，供空状态与故障排查使用。

#### Scenario: Diagnose zero runnable workflows

- **WHEN** 货架上可运行工作流数量为零
- **THEN** 系统可给出逐来源的诊断，指出各来源是不可达、无内容还是全部条目被排除，并说明排除原因
