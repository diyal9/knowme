## ADDED Requirements

### Requirement: Cross-product benchmark protocol

系统 MUST 定义统一竞品对比协议，用同一任务集、同一输入约束和同一评分 rubric 评估 KnowMe、Cursor、Workbuddy，避免不公平比较。

#### Scenario: Same-task same-rubric enforcement

- **WHEN** 执行 cross-product benchmark
- **THEN** 三个评估对象 MUST 使用相同任务描述与通过标准
- **AND** 评分器 MUST 使用同一 rubric 与权重

### Requirement: Adapter-based execution model

Benchmark MUST 通过适配器执行不同产品，适配器至少提供 `prepareContext`、`runTask`、`cleanup`，并输出统一结果 schema。

#### Scenario: Adapter output normalization

- **WHEN** 任一产品完成任务执行
- **THEN** 结果 MUST 归一化为统一字段（answer、toolLogs、latencyMs、rounds、errors、evidenceRefs）
- **AND** 不得因原生格式差异导致评分逻辑分叉

### Requirement: Benchmark task set governance

任务集 MUST 支持分层治理（如 `core-10` 与 `full-30+`），并对每个任务维护版本、意图、输入约束和判定标准。

#### Scenario: Core benchmark runs weekly

- **WHEN** 运行 `core-10` 套件
- **THEN** MUST 产出三产品可比结果
- **AND** 任一任务失败 MUST 指向具体归因标签

### Requirement: Comparative report outputs

Benchmark MUST 输出结构化对比报告，包含至少：总分、维度分、成功率、延迟分位数、失败分布和差距摘要。

#### Scenario: Comparative matrix is generated

- **WHEN** benchmark 执行完成
- **THEN** 报告 MUST 生成 `product x dimension` 矩阵
- **AND** MUST 提供 `KnowMe vs Cursor`、`KnowMe vs Workbuddy` 差距摘要

### Requirement: Fairness and reproducibility guardrails

Benchmark MUST 记录运行元数据（任务版本、评分版本、执行时间、环境摘要），并拒绝缺少关键元数据的结果进入正式对比。

#### Scenario: Missing metadata blocks official comparison

- **WHEN** 结果缺少任务版本或评分版本
- **THEN** 报告 MUST 标记该结果为 `invalid_for_official_compare`
- **AND** MUST NOT 计入正式排名或趋势统计
