# KnowMe Agent Team 主题计划

> 本文件专门记录 Agent Package、Agent Team、Builder 接入和 Runtime 标准化方向。
> 产品功能迭代维护在 [`ITERATION_PLAN.md`](ITERATION_PLAN.md)；具体实现仍必须建立对应的 OpenSpec change。

## 主题目标

让不同 Builder 生产的专业 Agent Team 能够通过统一协议安全、可验证地接入 KnowMe。用户不需要理解不同 Builder、模型供应商或 Agent 实现差异，即可在 KnowMe 中发现、安装、更新、运行和验收专业 Agent Team。

## 迭代条目

### IT-008｜Agent Package 与 Agent Team Runtime 标准化

- 状态：`Idea`
- 优先级：P1
- 目标用户：
  - 生产专业 Agent 或 Agent Team 的 Builder / 开发团队
  - 需要复用专业工作流的个人和企业用户
  - 负责 Agent 质量、权限和运行治理的管理员
- 核心范围：
  - [ ] Agent Package：`agent.manifest.json`、`AGENT.md`、skills、输入/输出 schema、测试与版本信息
  - [ ] Agent Team Package：团队 manifest、Workflow/DAG、Agent 版本锁定和门禁定义
  - [ ] Agent Service Protocol：统一任务上下文、`requestId`、`runId`、协议版本和远程服务适配
  - [ ] Agent Message Bus：标准 handoff、进度、澄清、审批、产物和失败消息
  - [ ] Agent Lifecycle：输入、输出、完成、阻塞、等待审批、取消、超时、预算耗尽和可重试失败
  - [ ] Runtime Governance：工具 allowlist、权限、沙箱、预算、审计日志、断点恢复和版本回滚
  - [ ] KnowMe 产品体验：Agent / Workflow 目录、运行时间线、Agent 间交接、产物和验收结果
- 产品原则：
  - Agent 负责专业判断，KnowMe 负责编排、通信、权限、状态和证据
  - Agent 间通信必须经过 KnowMe Runtime，不允许 Builder 建立不可审计的隐藏通道
  - Agent 完成不能只依赖自然语言声明，必须通过结构化输出和验收标准
  - 不同 Builder 可以使用不同模型和实现，但必须遵守同一套协议
- 非目标：
  - [ ] 首期不建设开放式 Agent 市场
  - [ ] 首期不允许 Agent 无审批执行任意系统命令或访问任意本地文件
  - [ ] 首期不替代现有本地 Agent Loop 和远程 Daemon，而是提供统一兼容层
- 验收标准：
  - [ ] KnowMe 可以导入并校验版本化 Agent Package
  - [ ] KnowMe 可以识别 Agent 能力、工具、权限、输入和输出格式
  - [ ] 两个不同 Builder 生产的 Agent 可以加入同一个 Team Workflow
  - [ ] Agent 可以通过标准消息完成串行交接、并行汇聚和门禁回退
  - [ ] 用户可以看到每个 Agent 的输入摘要、执行状态、交接消息、产物和证据
  - [ ] Agent 在完成、阻塞、等待输入、等待审批、失败和取消时都有明确状态
  - [ ] 运行可以被取消、恢复、重试，并保留可审计的 Run Event Log
  - [ ] 不同协议版本或权限不兼容时，KnowMe 给出明确的兼容性提示
- 依赖：
  - `IT-005` 统一工作上下文
  - `IT-007` 技能目录与产品能力入口
  - 现有 `.cursor/agents`、`.cursor/workflows`、Agent Loop 和 Workbench Daemon 协议
- 关联 change：待创建，建议名称 `agent-package-and-team-runtime`
- 当前下一步：
  - [ ] 定义 Agent Package、Team Package 和 Message Envelope schema
  - [ ] 梳理本地 Agent Loop 与远程 Daemon 的协议兼容边界
  - [ ] 形成 Builder 接入规范和最小可运行示例
  - [ ] 制作人确认首期 MVP 范围后创建 OpenSpec change

## 主题决策记录

| 日期 | 决策 / 反馈 | 影响条目 | 后续动作 |
|------|-------------|----------|----------|
| 2026-08-01 | 将 Agent Team 与 Builder 生态方向从总迭代计划拆分为独立主题计划 | IT-008 | 先定义协议与 MVP 边界，再建立对应 OpenSpec change |
