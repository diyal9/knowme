## MODIFIED Requirements

### Requirement: Deferred dynamic orchestration

工作台 MUST 支持通过目标输入进入 Agent Graph 草案和确认流程；动态编排 MUST 使用已安装且已授权的 Agent 能力生成可解释 Graph，并在执行前完成 Graph、Agent 引用、handoff、权限和治理校验。客户端不得直接执行未经确认的任意 Graph。固定本地工作流和 Daemon workflow 仍可作为兼容执行入口，但动态 Agent Graph 的正式执行 MUST 进入统一的 Team Runtime。

#### Scenario: Dynamic orchestration from workbench

- **WHEN** 用户在工作台输入目标并选择动态 Agent 协作
- **THEN** 工作台展示 Agent Graph 草案、节点职责、执行关系和确认入口

#### Scenario: Confirmed dynamic orchestration

- **WHEN** 用户确认通过校验的 Agent Graph
- **THEN** 工作台创建本地 Team Run，并将真实 Run Tree 状态投影到任务区域

#### Scenario: Invalid dynamic orchestration

- **WHEN** Graph 引用未知 Agent、包含环或不满足治理约束
- **THEN** 工作台阻止执行并保留可修订的 Graph 草案
