# Design: establish-knowme-evals-system

## Context

现有 KnowMe 评估能力集中在 deterministic fixture 回归，已能覆盖关键事故与基础行为门禁，但仍缺少：

1. 自评全景：从离线回归扩展到准真实端到端质量监控。
2. 对标能力：与 Cursor、Workbuddy 的统一对比协议。
3. 运营闭环：趋势追踪、失败归因和工程优先级映射。

本设计在不破坏现有测试稳定性的前提下，增量构建三层 Evals System。

## Goals

- 统一 L0/L1/L2 评估框架与报告协议。
- 明确 hard/soft 维度边界，确保门禁低噪音、可解释、可复现。
- 建立跨产品公平性约束（同任务、同输入、同评分）。
- 让评估结果可直接转化为任务化改进。

## Non-goals

- 不将在线 judge 作为硬门禁。
- 不追求一次性覆盖所有任务类型，优先“可运行 + 可扩展”。
- 不修改与评估无关的 UI/连接器主流程。

## Architecture

### 1) Layered eval suites

- L0: `hard-offline`
  - 数据源：fixture + mock ports
  - 目标：回归防护
  - 触发：PR/CI
- L1: `self-e2e-controlled`
  - 数据源：真实 runtime + 受控 connector/知识样本
  - 目标：真实行为稳定性
  - 触发：nightly
- L2: `cross-product-benchmark`
  - 数据源：统一任务集 + 各产品适配器
  - 目标：竞品对标与差距定位
  - 触发：weekly 或里程碑

### 2) Shared scoring model

- 必选维度：
  - correctness: `taskCompletion`, `factFaithfulness`, `contextContinuity`
  - tool quality: `toolChoice`, `toolArgs`, `toolSuccessRate`
  - safety: `refusalWhenUnmet`, `ungroundedClaimRate`
  - efficiency: `rounds`, `toolCalls`, `latencyMs`
  - resilience: `cancelCascadeLatency`, `recoveryPassRate`
- 判定分层：
  - hard dimensions：用于阻断（默认 deterministic 规则）
  - soft dimensions：用于趋势和优化优先级

### 3) Benchmark adapter contract

新增统一适配器协议（逻辑接口）：

- `prepareContext(task)`
- `runTask(task) -> normalizedResult`
- `cleanup()`

其中 `normalizedResult` 至少包含：

- `finalAnswer`
- `toolLogs`
- `evidenceRefs`
- `latencyMs`
- `rounds`
- `errors`

三种实现：

- `knowmeAdapter`
- `cursorAdapter`
- `workbuddyAdapter`

### 4) Report protocol

统一报告输出：

- JSON：供脚本和 gate 消费
- Markdown：供人审阅与回顾

关键字段：

- suite 元信息（name/version/baseline/runAt）
- per-scenario 评分、阈值对比、failReasons
- 汇总指标（passRate、p50/p90 latency、failure taxonomy）
- 跨产品对比矩阵（按维度与任务组）

## Data and fixture strategy

- 任务集分层管理：`core`（PR）与 `full`（nightly/weekly）。
- 场景命名规范：`<domain>-<pattern>-<expected>`
- 阈值版本化：`v1`, `v2`...，每次变更需显式说明理由。
- 失败归因标签：`missing_tool`, `wrong_tool_args`, `ungrounded_claim`, `context_drift`, `recovery_fail`, `timeout`。

## Rollout plan

1. 第一阶段：固化 L0，扩展维度与报告，不改变现有通过基线。
2. 第二阶段：引入 L1 准真实套件，先 advisory 后 hard。
3. 第三阶段：接入 L2 对比适配器，先 10 场景试运行，再扩展到 30+。

## Risks and mitigations

- 风险：跨产品输出格式差异大。
  - 缓解：先做 normalization schema，适配器只负责映射。
- 风险：评估波动导致误报。
  - 缓解：hard 维度坚持 deterministic；非确定性指标仅作软信号。
- 风险：团队维护成本上升。
  - 缓解：小集 PR、大集 Nightly，报告自动聚合失败归因。

## Open questions

- Cursor/Workbuddy 适配器在本地运行时的最小权限和数据边界如何定义。
- 跨产品成本指标是否纳入正式评分，还是仅做观察项。
- L2 报告是否需要进入产品内可视化面板，还是先保留在 evidence。
