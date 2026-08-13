## Why

KnowMe 已具备可验证的单 Agent Loop，但当前 `spawnSubRun` 只登记运行标识，缺少真实子 Run、持久化 Run 树、标准 Agent 通信和跨 Builder 治理。Agent Team 是知识工作台的核心执行能力，需要由 KnowMe 统一承担编排、权限、状态、证据和恢复，避免专业 Agent 形成不可审计的隐藏通道。

## What Changes

- 建立版本化 Agent Package 与 Agent Team Package，声明 persona、能力绑定、输入输出 schema、Workflow/DAG、门禁、测试和版本锁。
- 建立 Agent Service Protocol 与内部 Agent Message Bus，统一本地 Executor、Cursor/Claude 兼容包和 Workbench Daemon 的任务、handoff、审批、Artifact、Evidence 与终态消息。
- 增加持久化 RunManager、Scheduler、Launcher 和 RunStore，真实启动隔离子 Run，支持有限并行、等待汇聚、重试、取消、恢复和审计。
- 将工具 allowlist、Expert 快照、Connector 授权、沙箱、预算、超时与 draft 审批纳入每个父/子 Run 的强制治理。
- 扩展 Run 时间线，展示 Agent 输入摘要、父子状态、交接、审批、产物、证据、预算和停止原因。
- 建立跨 Builder、多 Agent、崩溃恢复、安全注入及 Electron/Daemon E2E 生产门禁。

### 目标用户

- 生产专业 Agent 或 Agent Team 的 Builder 与开发团队。
- 希望安装、运行和复用专业工作流的个人及企业用户。
- 负责 Agent 权限、质量、成本和审计治理的管理员。

### 商业化与体验价值

- 用统一 Package 和 Runtime 降低专业 Agent 接入成本，为后续精选能力目录、企业治理与团队工作流订阅建立基础。
- 用户无需理解 Builder、模型或远程服务差异，即可获得一致的运行、审批、取消、恢复和验收体验。
- 结构化证据与可审计 Run Event Log 降低企业采用 Agent 的安全与合规风险。

### 验收标准

- 两个不同 Builder 的 Agent 可加入同一 Team Workflow，完成串行交接、有限并行汇聚和门禁回退。
- `spawnSubRun` 启动真实隔离 Executor 或远程 Agent Service，不再返回登记式假成功。
- 所有 Run 可查询、取消、重试和安全恢复；父取消后 3 秒内无活动子 Run 或后台进程。
- 未授权工具、未审批副作用、无证据外部事实和未知协议版本全部 fail-closed。
- 用户可查看完整 Run 树、handoff、审批、Artifact、Evidence 与停止原因。
- Run Event Log 可恢复、可审计，且不持久化密钥或敏感工具参数明文。

### 非目标（Non-goals）

- 首期不建设开放式 Agent 市场、计费结算或第三方自动发布平台。
- 首期不允许 Agent 无审批执行任意系统命令或访问任意本地路径。
- 不替换现有单 Agent Loop、Grounding Runtime 或 Workbench Daemon；通过统一兼容层接入。
- 不向子 Agent 默认复制父会话完整历史，也不暴露模型内部推理草稿。

## Capabilities

### New Capabilities

- `agent-package`: Agent Package 与 Team Package 的结构、校验、版本和兼容导入。
- `agent-team-runtime`: 持久化 Run 树、Scheduler、真实子 Run、并行汇聚、恢复与治理。
- `agent-service-protocol`: 本地与远程 Builder 的能力握手、任务执行、取消、恢复和兼容错误。
- `agent-message-bus`: 父子 Agent 的版本化消息 envelope、handoff、审批、Artifact、Evidence 和终态。
- `agent-run-store`: append-only Run Event Log、原子快照、checkpoint、幂等收据与留存策略。

### Modified Capabilities

- `agent-orchestration`: 从内存占位编排升级为真实父子 Run、等待汇聚、取消传播和结构化错误上浮。
- `agent-run-executor`: 接入 orchestration port、真实超时/取消传播和父子证据汇总。
- `agent-output-protocol`: 增加子 Run 生命周期映射，同时保持 answer lane 与单终态约束。
- `expert-runtime`: 将编排策略、能力快照和允许子专家强制应用到每个子 Run。
- `tool-contract-registry`: 在 Registry 热路径强制 per-Run 权限、超时、取消、幂等和审批。
- `agent-eval-harness`: 增加跨 Builder、多 Agent、恢复、审批和安全场景硬门禁。
- `workspace`: 展示 Run 树、handoff、审批、Artifact、Evidence 和恢复控制。

## Impact

- 主进程：`src/main.js` 的 ai-generate、取消与工具面装配改由 RunManager/Launcher 协调。
- 内核：`src/lib/agent-run-*`、`agent-orchestration.js`、`agent-output-protocol.js`、`tool-contract-registry.js`、Expert/Capability Runtime。
- 渲染进程：`src/lib/agent-message-state.js`、`src/workspace-agent.js`、preload IPC。
- 数据：新增 `%APPDATA%\KnowMe\agent-runs\<runId>\` 事件日志与原子快照；不引入 Electron 原生数据库依赖。
- 测试与运维：新增 Package/协议契约测试、真实父子 Executor 集成测试、恢复/取消/审批安全测试和 Electron/Daemon E2E evidence。
