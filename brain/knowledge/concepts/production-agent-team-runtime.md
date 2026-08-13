---
type: Concept
title: Production Agent Team Runtime
description: KnowMe production architecture for real child runs, durable orchestration, cross-builder packages, governance, recovery, and auditable multi-agent execution.
tags: [agent, multi-agent, runtime, orchestration, package, governance, recovery, audit]
timestamp: 2026-08-07T09:49:00Z
resource: knowme://agent/team-runtime
---

# Scope

沉淀 KnowMe 生产级 Agent Team Runtime 的长期架构原则。目标是让多 Agent 工作流由确定性的 Runtime 治理，而不是依赖模型自行维持角色、状态、权限和终态。

# Core architecture

- `AgentRunExecutor` 保持为唯一单 Run 模型、工具、Grounding 和输出循环。
- `RunManager` 是 Run 树与生命周期的权威来源。
- `Scheduler` 强制并发、依赖、join、重试和预算，不执行模型或工具。
- `Launcher` 为每个父/子 Run 创建独立上下文、权限快照、EvidenceLedger 和取消句柄。
- `RunStore` 使用 append-only JSONL、原子 `state.json`、checkpoint 和幂等 receipt。
- `MessageBus` 提供版本化父子消息；与 Renderer Output Protocol v2 分层。
- Agent/Team Package 与 Adapter 统一 local、Cursor、Claude 和 Daemon 后端。

# Runtime invariants

- 子 Run 必须真实启动独立 Executor 或远程 Agent Service；禁止登记式假成功。
- 子 Run 默认不继承父会话完整历史，只接收 ≤32KB 结构化 handoff 与 artifact refs。
- 每个 Run 权限是 Tool Registry、Agent/Expert 声明、Connector 和用户授权的交集；远程后端只能缩权。
- 未授权工具、未审批副作用、未知协议和无证据外部事实一律 fail-closed。
- 子 Agent 输出按不可信输入处理，必须经过 schema、大小、字段白名单和注入风险校验。
- 父取消后 3 秒内子 Run 与后台进程归零。
- terminal exactly-once；外部副作用以 idempotency key、receipt 和 CAS 防止恢复重放。
- 子 Run 不直接写入父 answer lane；UI 只消费稳定的 Run 树摘要与最终提交内容。

# Durable execution

- 存储根：`%APPDATA%\KnowMe\agent-runs\<runId>\`。
- `events.jsonl` 使用单调 seq、hash chain 与敏感字段脱敏。
- `state.json` 原子替换；损坏后从最后有效事件重放。
- 崩溃中的模型/工具调用转为 `INTERRUPTED`，由用户继续、重试或放弃，不盲目自动重跑。
- 每个子 Run 有独立 EvidenceLedger；父 Run 只消费带 provenance 的证据摘要。

# Package and workflow model

- Agent Package：persona、能力、I/O schema、工具权限、编排策略、测试与版本。
- Team Package：成员版本锁、Workflow/DAG、join、门禁和失败策略。
- 导入与运行前必须验证 Builder 协议、schema、DAG、权限交集和后端能力握手。

# Product contract

Run 树默认折叠，按需显示 Agent/Builder、输入摘要、状态、handoff、审批、Artifact、Evidence、预算、停止原因，以及取消、重试和恢复操作。不得展示模型内部推理或未提交草稿。

# Non-goals

- 不替换现有单 Agent Loop、Grounding Runtime 或 Workbench Daemon。
- 首期不建设开放 Agent 市场、计费结算或第三方自动发布。
- 不允许 Agent 无审批执行任意系统命令或访问任意本地路径。

# Validation baseline

2026-08-07：`npm test` 1391/1391、Lint PASS、Conversation Eval 8/8、Team Runtime 88/88、Electron 13/13、Agent Service loopback 6/6；制作人验收、测试 QA 与 Harness gate 通过。

# Related

- Wiki 详解：`../../wiki/concepts/production-agent-team-runtime.md`
- 单 Agent 运行链路：[/concepts/llm-processing-and-cursor-benchmark.md](/concepts/llm-processing-and-cursor-benchmark.md)
- Electron IPC：[/concepts/electron-ipc.md](/concepts/electron-ipc.md)
- 规格来源：`openspec/changes/agent-package-and-team-runtime/`
