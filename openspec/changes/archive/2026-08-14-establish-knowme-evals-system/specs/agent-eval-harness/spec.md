## MODIFIED Requirements

### Requirement: Layered evaluation suites

`agent-eval-harness` MUST 支持分层 suite 语义，至少包含 `hard-offline`（L0）、`self-e2e-controlled`（L1）和可被 benchmark 调用的共享评分组件。L0 MUST 保持离线可运行且作为硬门禁基线。

#### Scenario: L0 remains offline hard gate

- **WHEN** 在无 API Key 和无外网条件执行 `npm test` 或等价硬门禁
- **THEN** `hard-offline` 场景 MUST 可运行并产出 deterministic 结果
- **AND** 任一 hard dimension 回归 MUST 失败并给出明确 diff

#### Scenario: L1 emits controlled-runtime metrics

- **WHEN** 运行 `self-e2e-controlled` suite
- **THEN** 报告 MUST 包含 `latencyMs`、`rounds`、`toolCalls`、`cancelCascadeLatency`、`recoveryPass`
- **AND** 不得缺失基础维度分数

### Requirement: Self-eval dimensions and thresholds

Harness MUST 在现有维度基础上支持自评扩展维度：`toolSuccessRate`、`ungroundedClaimRate`、`latencyMs`、`recoveryPassRate`，并允许通过版本化 baseline 指定 hard/advisory 阈值。

#### Scenario: Threshold version upgrade is explicit

- **WHEN** 从 `v1` 升级到 `v2` baseline
- **THEN** 新增维度阈值 MUST 在版本文件中显式定义
- **AND** 报告 MUST 标记 baseline version

#### Scenario: Non-deterministic signals are advisory

- **WHEN** 某维度来源含非确定性信号（例如语义 judge）
- **THEN** 该维度 MUST 默认不进入 hard dimensions
- **AND** 报告 MUST 标注为 advisory

### Requirement: Failure taxonomy and traceability

Harness MUST 为失败结果输出标准化归因标签，至少覆盖：`missing_tool`、`wrong_tool_args`、`ungrounded_claim`、`context_drift`、`recovery_fail`、`timeout`。

#### Scenario: Failed scenario includes taxonomy labels

- **WHEN** 场景因 required tool 缺失失败
- **THEN** 报告 MUST 含 `missing_tool` 标签
- **AND** MUST 包含 `scenario + dimension + failReason` 三元信息

### Requirement: JSON and Markdown report contract

Harness 报告 MUST 同时输出 JSON 和 Markdown，且 JSON MUST 可被门禁和后续分析脚本消费。

#### Scenario: Report includes summary and per-scenario breakdown

- **WHEN** 以 `--out` 参数执行 eval
- **THEN** 输出文件 MUST 包含 suite 元信息、汇总统计、分场景维度得分与失败归因
- **AND** Markdown MUST 可供人工审阅
