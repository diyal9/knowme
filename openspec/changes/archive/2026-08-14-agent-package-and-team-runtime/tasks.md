## 1. Package 与协议契约

- [x] 1.1 实现 Agent/Team Package manifest、JSON Schema 子集校验、DAG 无环校验与版本锁快照（agent-package）
- [x] 1.2 实现 Local、Cursor、Claude 与 Daemon Package Adapter 的规范化、兼容握手与 fail-closed 错误（agent-package, agent-service-protocol）
- [x] 1.3 提供两个 Builder 示例 Agent Package 与串行/并行/门禁 Team Workflow fixture（agent-package, agent-eval-harness）
- [x] 1.4 实现版本化 Agent Message Bus envelope、路由、seq、去重、payload 限制和持久化镜像（agent-message-bus）

## 2. 持久化 Runtime 基础

- [x] 2.1 实现 append-only events.jsonl、敏感字段脱敏、hash chain 与严格 seq（agent-run-store）
- [x] 2.2 实现原子 state.json、checkpoint、Run 树索引、损坏日志容错 replay 与 INTERRUPTED 恢复（agent-run-store）
- [x] 2.3 实现幂等 receipt、CAS/重复副作用防护、归档 TTL 与安全查询（agent-run-store）
- [x] 2.4 实现 RunManager 状态机、父子树、terminal exactly-once、查询/重试/恢复与事件广播（agent-team-runtime）
- [x] 2.5 实现 Scheduler 队列、有限并行、深度、预算、公平性、join、timeout 与 retry backoff（agent-team-runtime）

## 3. Launcher 与真实父子执行

- [x] 3.1 实现 Launcher backend registry、LocalExecutorAdapter 与真实独立 AgentRunExecutor child launch（agent-team-runtime, agent-run-executor）
- [x] 3.2 实现 Agent Service Adapter 与 Cursor/Claude/Daemon backend 的握手、执行、状态、取消和恢复映射（agent-service-protocol）
- [x] 3.3 扩展 orchestration tools：delegate/spawn/await/status/cancel/message/handoff，并接入 RunManager（agent-orchestration）
- [x] 3.4 将 main.js 占位 spawnSubRun 替换为 Runtime，接通根 Run 注册、持久化与 ai-cancel-run 级联（agent-orchestration, agent-team-runtime）
- [x] 3.5 扩展 RunPorts/kernel adapter，传递 orchestration、RunStore checkpoint、signal 与 timeout（agent-run-executor）

## 4. 权限、审批与证据治理

- [x] 4.1 实现 per-Run capability snapshot 与 Tool Registry allowlist/denylist/Connector/Expert 交集投影（expert-runtime, tool-contract-registry）
- [x] 4.2 在 Registry 热路径强制 timeout、AbortSignal、idempotency key、approval 与审计父子关联（tool-contract-registry）
- [x] 4.3 接通 Run 预算、wall timeout、沙箱/进程 registry 和父取消 ≤3s 资源回收（agent-team-runtime）
- [x] 4.4 校验子 Run handoff/output schema、32KB 限制、Prompt Injection 标记与父子 EvidenceLedger 汇总（agent-message-bus, agent-run-executor）

## 5. Output Protocol 与 Workspace

- [x] 5.1 扩展 Output Protocol v2 的 subrun started/progress/waiting/terminal 事件及 Message Bus 映射（agent-output-protocol）
- [x] 5.2 扩展 renderer message state，按 Run 分区维护 Run 树、handoff、审批、Artifact、Evidence、预算与停止原因（workspace, agent-output-protocol）
- [x] 5.3 新增 Run tree/resume/retry/cancel IPC 与 preload 最小 API（workspace, agent-team-runtime）
- [x] 5.4 在 Agent 时间线实现默认折叠 Run 树、Builder/Expert 标签、操作按钮与隐私脱敏（workspace）

## 6. 验证与生产门禁

- [x] 6.1 增加 Package、Bus、RunStore、RunManager、Scheduler、Registry 与协议适配器单元测试（agent-eval-harness）
- [x] 6.2 增加真实父子 Executor、并行 join、错误上浮、审批等待、超时和级联取消集成测试（agent-eval-harness）
- [x] 6.3 增加崩溃恢复、幂等副作用、未知协议、未授权工具与子 Agent 注入安全测试（agent-eval-harness）
- [x] 6.4 扩充 conversation/executor eval 报告的 subRuns、handoff、cancelCascade 与 receipt 指标（agent-eval-harness）
- [x] 6.5 完成 Electron/Daemon smoke evidence、开发自测报告、code review、npm test/lint/eval/Harness gate（workspace, agent-eval-harness）
