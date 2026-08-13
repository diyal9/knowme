## Context

当前工作台的本地路径在 Renderer 中维护 `run.currentId` 和临时 Graph，并通过一次性 `workbenchDispatch` 派单；Daemon 路径由主进程通过 HTTP Client 管理远程 Task。另一方面，主进程已经初始化 `AgentRunManager`、`AgentRunStore`、`AgentRunLauncher` 和消息总线，`AgentTeamWorkflowRunner` 已能按 Team Package DAG 执行 Agent、gate、join 和 terminal，但尚未成为 Workbench 的入口。

本变更只增加工作台到现有 Team Runtime 的适配，不改变 Agent Executor 的模型循环。Renderer 负责目标、Graph 草案和状态展示；主进程负责能力解析、Package 编译、校验、Run 创建和权威状态。

## Goals / Non-Goals

**Goals:**

- 用结构化 DTO 表达 Workbench Agent Graph 草案和确认快照。
- 将 Workbench Agent/Expert 引用安全地解析为可执行 Agent Package。
- 将 Graph 编译为 Team Package，使用显式 `edges`、handoff、parallelism 和治理限制。
- 通过主进程启动本地 Team Runtime，并将真实 Root/child Run 投影到工作台。
- 保留 Daemon Task 的现有协议和独立语义。
- 在首个垂直切片中支持串行 Agent、并行 Agent、gate 和 terminal。

**Non-Goals:**

- 不重写 `AgentRunExecutor`、工具循环、模型适配器或 Daemon API。
- 不在 Renderer 中运行模型、创建 child Run 或读取用户文件路径。
- 不实现任意 Graph 脚本节点、无限循环或未经声明的工具节点。
- 不承诺应用重启后无条件恢复正在执行的远程或本地 Run。

## Decisions

### 1. 通过纯函数编译 Workbench Graph

新增纯模块 `workbench-agent-graph`，输入为：

```text
{
  goal,
  members: [{ id, expertId, agentPackageId, role, intent }],
  edges: [{ from, to, label }],
  gates: [{ id, title, ... }],
  parallelism,
  joinStrategy
}
```

输出为：

```text
{
  ok,
  composition,
  teamPackage,
  snapshot: { packageRefs, contentHashes, goal },
  issues: []
}
```

该模块只负责归一化、映射和调用 Package 校验所需的结构，不执行 Agent。这样可以直接进行 Node 单测，也避免把权限和文件访问逻辑放进 Renderer。

备选方案是直接复用 `workbench-model` 的旧 JSON。该方案会把 `agent`、`next` 和 Renderer 分支字段泄漏给 Team Runtime，无法保证显式边、Package 引用和 handoff 一致，因此不采用。

### 2. 主进程作为唯一执行边界

新增受限 IPC：

- `workbench-agent-graph-plan`：接收目标和可用 Agent 选择，返回 Graph 草案或校验问题。
- `workbench-agent-graph-validate`：校验用户确认后的 DTO 和 Team Package 快照。
- `workbench-agent-graph-start`：只接受已校验的快照，创建 Root Run 并启动 Team Runner。
- `workbench-agent-run-tree`：读取 Root Run Tree。
- `workbench-agent-run-decision`：提交 gate 决策。

Renderer 不获得 `AgentRunManager`、文件系统或任意 Package loader。已有 `agent-run-status/tree/cancel/retry/resume` IPC 可复用，但 Workbench 入口仍使用带有 Workbench 语义的结构化 payload，避免 UI 拼装内部运行时参数。

### 3. 目标规划采用确定性首版

首版不让模型直接生成可执行 Graph。规划器从当前可用 Expert/Agent 的能力标签、角色和声明的 workflow nodes 中生成有限候选：

- 单 Agent：一个 Agent → terminal。
- 串行团队：Agent A → Agent B → terminal。
- 并行汇总：Agent A、Agent B → join → terminal。
- 带审批：Agent → gate → Agent → terminal。

用户确认后才编译执行。后续可增加 LLM 排序，但 LLM 输出必须先转换为同一 DTO，再通过全部校验。

### 4. Agent 引用使用快照而非裸 ID

编译阶段通过现有 Expert/Agent Package resolver 解析每个成员，保存：

- packageId
- version
- contentHash
- builder/backend
- governance 和权限摘要

执行时再次校验快照；解析失败、版本漂移或授权失效都阻止启动。这样避免能力目录变化后历史任务被悄悄替换。

### 5. 用 Run Tree 作为运行时事实源

Workbench `run` 只保存：

```text
mode: 'agent-graph'
rootRunId
compositionSnapshot
projection
```

Graph 节点显示由 `rootRunId` 的 Run Tree 映射：

```text
composition node id ↔ childRun.meta.workflowNodeId ↔ childRun.status
```

Renderer 不再根据 `currentId` 猜测本地 Agent Graph 的真实进度。旧本地工作流仍使用 legacy projection，Daemon 继续使用 task projection。

### 6. Electron 边界与性能

- 主进程只在启动时加载和校验 Agent Package；状态刷新只读取 Run Store/Runtime DTO。
- Renderer 只保存一个当前 Graph 草案和一个 rootRunId，不缓存完整 Agent Package 内容。
- Run Tree 轮询采用单 timer，终态后停止；若已有事件桥，则优先复用事件通知。
- Graph 节点、Agent 数量、handoff 文本和 snapshot 摘要均设上限，避免大目标导致 IPC 或 DOM 膨胀。
- Team Runtime 使用已有 scheduler、预算、深度和并行限制，不额外创建进程池。

## Risks / Trade-offs

- [协议字段不一致] Workbench legacy workflow 与 Team Package schema 不同 → 通过独立编译器和 `validateTeamPackage` 阻断直接透传。
- [现有 Runtime 尚未直接暴露 Team Runner] 主进程需要增加最小适配入口 → 不修改 Agent Executor，仅在 `ensureAgentTeamRuntime()` 旁增加 Runner 实例和受限 IPC。
- [本地 Agent Package 不完整] 能力目录可能只有 Expert Snapshot 或旧 manifest → 首版只接受能解析为合法 Package 的成员，其他能力展示为不可执行。
- [运行状态投影延迟] Run Store 轮询可能短暂落后 → UI 显示“正在同步运行状态”，不将旧状态当作终态。
- [应用重启恢复受限] 原会话执行端口可能不存在 → 返回重新确认，不伪造 resume。
- [用户确认增加步骤] Graph 预览会增加启动前交互 → 用推荐 Graph 和一键确认降低成本，同时保持安全边界。

## Migration Plan

1. 先加入纯 Graph 编译和校验模块，不改变旧入口。
2. 增加主进程 Team Run IPC，并用 feature flag 开启 Agent Graph。
3. 工作台仅对“动态 Agent 协作”入口使用新 Runtime；Daemon 和旧本地工作流保持可用。
4. 通过单元、Runtime 集成和 Electron smoke 后，将新入口设为默认。
5. 如需回滚，关闭 feature flag；已创建的 Run 保留在 Run Store，旧工作流继续可用。
