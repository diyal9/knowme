# KnowMe 生产级 Agent Team Runtime

本页沉淀 `agent-package-and-team-runtime` 方案的架构、治理与验收结论。它把 KnowMe 从单 Agent 工具循环扩展为可持久化、可恢复、可审计的多 Agent 执行平台。

## 一句话结论

生产级多 Agent 的关键不是让模型自行“扮演团队”，而是由 Runtime 强制管理真实父子 Run、权限、预算、消息、证据和恢复。`AgentRunExecutor` 继续负责单 Run 的模型与工具循环，新增的协调层负责团队编排。

## 要解决的问题

旧实现中的 `spawnSubRun` 只登记标识，没有启动独立 Executor，因而无法证明子 Agent 真正执行，也无法可靠取消、恢复或审计。生产方案必须满足：

- 子 Run 是独立执行实例，而非父模型返回的登记式假成功。
- 父子状态、handoff、Artifact、Evidence 和终态可追溯。
- 本地、Cursor、Claude 和 Workbench Daemon 使用统一兼容协议。
- 未授权工具、未审批副作用、无证据外部事实和未知协议均 fail-closed。
- 父 Run 取消后 3 秒内子 Run 与后台进程归零。

## 架构分层

```text
Renderer Run 树与时间线
          │ Output Protocol v2 / IPC
          ▼
RunManager ── Scheduler ── Launcher ── AgentRunExecutor（每个 Run 一个实例）
    │             │            │
 RunStore      MessageBus    Package Adapters
                               ├─ local
                               ├─ cursor
                               ├─ claude
                               └─ daemon
```

### 职责边界

- **AgentRunExecutor**：唯一的单 Run 模型、工具、Grounding、Verify 与最终输出循环。
- **RunManager**：Run 树和生命周期的权威来源，负责创建、查询、取消、重试和恢复。
- **Scheduler**：有限并行、依赖、join、退避、深度和 wall-clock 预算；不执行模型或工具。
- **Launcher**：选择本地或远程后端，为子 Run 创建独立上下文、权限快照和 AbortSignal。
- **RunStore**：append-only 事件日志、原子状态、checkpoint、幂等收据和恢复。
- **MessageBus**：父子 Agent 间版本化消息，承载任务、handoff、审批、产物、证据和终态。
- **Package Adapter**：校验 Agent/Team Package、版本锁、Builder 兼容性、DAG 和权限声明。

这条边界避免出现两个模型循环：协调层不能内联 LLM loop，Executor 也不能成为 Run 树权威。

## Package 与跨 Builder 协议

Agent Package 声明 persona、能力、输入输出 schema、工具白名单、编排策略、测试和版本；Team Package 声明成员版本锁、Workflow/DAG、join、门禁和失败策略。

导入或运行时必须校验：

1. Package 与 Builder 协议版本。
2. 输入输出 schema 和 Team DAG。
3. Agent/Expert、Connector 与工具权限交集。
4. 本地或远程后端能力握手。

任何未知版本或权限扩大都应拒绝执行。远程 Adapter 只能缩小权限，不能扩大 Runtime 已物化的 capability snapshot。

## 父子 Run 执行流

1. 父 Run 调用 `delegate_to_expert` 或 `spawn_sub_run`。
2. RunManager 创建带父子关系的 Run，并持久化 `run.created`。
3. Scheduler 校验深度、并发和预算后入队。
4. Launcher 创建独立 Session slice、EvidenceLedger、Tool Surface 与 AbortController。
5. 本地后端启动新的 `AgentRunExecutor.run()`；远程后端通过 Agent Service Protocol 启动任务。
6. 子 Run 仅接收不超过 32KB 的结构化 handoff 与 artifact refs，不复制父会话完整历史。
7. 子终态经 MessageBus 返回 summary、artifact/evidence refs、metrics 和结构化错误。
8. Scheduler 完成串行交接或并行 join，父 Run 再继续 Verify 与 Finalize。

子 Run 的进度不能直接写入父对话 answer lane；Renderer 只展示稳定摘要，最终答案仍遵守 Output Protocol v2 的单终态约束。

## 持久化、恢复与幂等

运行数据位于 `%APPDATA%\KnowMe\agent-runs\<runId>\`：

```text
events.jsonl
state.json
checkpoints/
receipts/
```

- `events.jsonl` 使用严格递增 seq、hash chain 和敏感字段脱敏。
- `state.json` 通过临时文件与原子 rename 更新；损坏时可从事件日志重放。
- 进程崩溃后，执行中的模型或工具调用标记为 `INTERRUPTED`，不盲目自动重放。
- 外部副作用使用 idempotency key、draft/applied receipt 和 CAS；恢复或双击不得重复发送。
- terminal 只允许发出一次，重复 finalize 或重复消息必须被去重。

## 权限与安全治理

每个 Run 创建不可变的权限快照，来源是全局 Tool Registry、Agent/Expert 声明、启用 Connector 和用户授权的交集。Runtime 在 Registry 热路径强制：

- 工具 allowlist/denylist、路径与网络沙箱。
- AbortSignal、工具超时、wall timeout 和进程回收。
- Token、轮次、工具调用、时间与可选费用预算。
- 写操作 draft → approve → apply。
- 子 Agent 输出 schema、大小和字段白名单校验。
- Prompt Injection 标记；子输出一律按不可信输入处理。

每个子 Run 拥有独立 EvidenceLedger。父 Run 只接收带 provenance 的证据摘要；无证据或被截断的子结果不能支撑父 Run 的外部事实结论。

## 产品呈现

Run 树嵌入现有 Agent 时间线，默认折叠，按需展示：

- Agent、Expert 与 Builder 标签。
- 输入摘要、状态、handoff 和停止原因。
- 审批、Artifact、Evidence、预算和安全警告。
- 取消、重试与恢复操作。

界面不展示模型内部推理、未提交草稿或子 Run 的噪声工具流。

## 回滚与兼容

- `KNOWME_AGENT_TEAM_RUNTIME=0` 可关闭 Team orchestration；委派仍 fail-closed，不恢复登记式假成功。
- 旧 Session 没有 Run 树时继续按原单 Agent 对话展示。
- 不替换 Grounding Runtime、Workbench Daemon 或单 Agent Loop。
- 首期不建设开放市场、计费结算，也不允许 Agent 无审批获得任意系统权限。

## 验收基线

2026-08-07 的生产门禁结果：

- `npm test`：1391/1391。
- Lint：通过。
- Conversation Eval：8/8。
- Team Runtime：88/88。
- Electron Run 树 smoke：13/13。
- Agent Service loopback E2E：6/6。
- 制作人验收、测试 QA 与 Harness gate：通过。

外部 Workbench live smoke 因示例 workflow 等待人工输入而未全绿，判定为环境性 Advisory；Package 导入专用 UI 与 live 取消动效录制也是后续体验增强项，不影响 Runtime 契约验收。

## 代码与规格锚点

- OpenSpec：`openspec/changes/agent-package-and-team-runtime/`
- 单 Run 内核：`src/lib/agent-run-executor.js`
- Run 协调：`src/lib/agent-run-manager.js`
- 调度：`src/lib/agent-run-scheduler.js`
- 启动器：`src/lib/agent-run-launcher.js`
- 持久化：`src/lib/agent-run-store.js`
- 消息总线：`src/lib/agent-message-bus.js`
- Package：`src/lib/agent-package-runtime.js`
- 编排工具：`src/lib/agent-orchestration.js`
- UI 状态：`src/lib/agent-message-state.js`

## 相关知识

- OKF 长期概念：`brain/knowledge/concepts/production-agent-team-runtime.md`
- LLM 单 Agent 链路：`brain/wiki/concepts/llm-processing-and-cursor-benchmark.md`
- Electron 架构：`brain/wiki/concepts/electron-architecture.md`
