## Why

工作台当前把本地工作流当作 Renderer 内的手动状态机，把远程工作流交给 Daemon；KnowMe 已有的 Expert、Agent Package、AgentRunManager 和 Team DAG Runtime 却没有成为工作台的真实执行路径。用户输入一个目标后，工作台应能从已安装能力中形成可解释、可确认的多 Agent Graph，并由本地 Runtime 持久化执行，而不是只能选择 Daemon 工作流或逐节点手动派单。

本变更将工作台定位为统一的 Agent 编排入口：本地 Agent Graph 作为首选执行能力，Daemon 作为保留的远程执行后端，二者共享目标、节点、状态、审批和结果投影。

## What Changes

- 新增从用户目标和已安装 Expert/Agent 能力生成 Graph 草案的结构化规划入口。
- 新增 Graph 草案确认流程：展示节点、角色、输入输出、串并行关系、权限边界和 gate。
- 新增 Workbench Composition 到 Team Package 的安全编译层，统一 Agent 引用、显式边、handoff、并行度和治理配置。
- 将确认后的本地 Agent Graph 接入现有 `AgentTeamWorkflowRunner`、`AgentRunManager`、`AgentRunStore` 和 Launcher。
- 为工作台增加本地 Team Run 的启动、状态树、取消、重试、gate 决策和结果读取 IPC。
- 将真实 child Run 状态投影到现有工作台 Graph、进度、日志、产物和最近任务区域。
- 保留现有 Daemon workflow 入口，并将其作为独立执行来源，不伪装成本地 Agent Run。
- 保留旧本地工作流作为兼容路径，动态 Agent Graph 通过 feature flag 或显式类型切换。
- **BREAKING**：新的动态组合不得直接调用 Renderer 的一次性 `workbenchDispatch` 作为正式 Agent 执行入口。

## Capabilities

### New Capabilities

- `workbench-agent-graph`: 从目标和可用能力生成、确认、校验并持久化 Workbench Agent Graph。
- `workbench-agent-runtime`: 通过 Team Package 和 Agent Team Runtime 执行本地 Graph，并向工作台提供统一 Run 状态、审批、恢复和结果。

### Modified Capabilities

- `agent-workbench`: 工作台任务执行来源从“本地手动工作流或 Daemon”扩展为“本地 Agent Graph、兼容本地工作流、Daemon workflow”，并统一任务投影。

## Impact

- 主进程：`src/main.js` 增加 Graph 编译、Team Run 启动和状态操作的结构化 IPC。
- 预加载：`src/preload.js` 暴露受限的 Graph/Run DTO 方法。
- 工作台：`src/workbench.js`、`src/workspace.html` 增加 Graph 草案、确认和 Runtime 状态投影。
- 新增纯模块：组合编译、能力匹配、Team Package 适配和 Workbench Run 投影。
- 复用并扩展：`src/lib/agent-package-runtime.js`、`src/lib/agent-team-workflow-runner.js`、`src/lib/agent-run-manager.js`。
- 不重写 `AgentRunExecutor`，不绕过 Agent Package trust、权限、handoff 和治理校验。
- 目标用户：希望直接提出目标、调用 KnowMe 内置能力并观察多 Agent 协作过程的桌面用户。
- 商业化价值：将工作台从模板浏览器升级为可复用的 Agent 协作入口，为后续能力包、团队模板和高级执行额度提供稳定承载面。

## 验收标准

- 用户输入目标后，可以看到由已安装 Agent 组成的 Graph 草案，并能在执行前确认。
- Graph 中的 Agent 均来自可解析、已授权的 Agent Package；未知 Agent、环、非法边或不闭合 handoff 会在执行前被阻断。
- 至少支持串行 Agent、并行 Agent、gate 和 terminal 节点。
- 确认后创建一个可追踪的根 Run，并在工作台显示 child Run、当前节点、状态、日志、审批和产物。
- 本地 Runtime 失败、取消、重试和 gate 等状态不会被渲染成成功完成。
- Daemon workflow 仍可单独启动，且不会与本地 Team Run 混淆。
- 应用刷新后可以读取已持久化的 Run Tree；无法安全恢复时必须显示重新确认，而不是伪造继续执行。
- `npm test`、`npm run lint`、OpenSpec 校验和 Electron smoke 通过。

## 非目标（Non-goals）

- 不重写 `AgentRunExecutor`、LLM tool loop 或现有 Agent Kernel。
- 不在本变更中实现新的模型供应商或新的远程 Daemon 协议。
- 不允许未经确认的全自动 Graph 执行。
- 不把任意用户输入直接转换成可执行脚本、工具调用或未授权 Agent。
- 不删除现有 Daemon 工作流和兼容本地工作流。
