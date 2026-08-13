## Why

KnowMe 已具备 deterministic conversation eval 基础，但当前评估仍以内部回归为主，缺少统一的自我评估体系与跨产品对比框架。缺口主要体现在三点：

- 缺少分层评估模型（离线硬门禁、准真实回放、跨产品对比）的一体化治理。
- 缺少稳定的竞品对比协议，无法持续量化 KnowMe 与 Cursor、Workbuddy 的能力差距。
- 缺少从评估结果到工程优先级的闭环标准，导致“测得出问题”但“不易转化为可执行改进”。

建立 Evals System 后，团队可以以统一任务集、统一评分和统一报告推进迭代，把“感觉更好”变成“指标更好”。

## What Changes

- 建立三层评估体系：
  - L0 `deterministic hard gate`：基于 fixture 与 mock script 的离线硬门禁（CI 必跑）。
  - L1 `quasi-real self eval`：真实 runtime + 受控数据源的端到端自我评估（Nightly 必跑）。
  - L2 `cross-product benchmark`：KnowMe、Cursor、Workbuddy 同任务同规则的对比评估（周更）。
- 扩展 `agent-eval-harness`，补齐自评维度与报告字段，支持更稳定的回归与趋势分析。
- 新增 `agent-competitive-benchmark` capability，定义跨产品适配器契约、评估流程和公平性约束。
- 在 `scripts/agent-eval.js` 基础上规划统一输出协议：JSON 机器可读 + Markdown 人类可读，便于接入 evidence 与 gate。
- 产出任务集治理规范：场景分层、版本管理、阈值演进、失败归因标签、升级/降级策略。

### 目标用户

- 负责 KnowMe 质量门禁的开发、测试与制作人角色。
- 需要对外展示产品能力演进和竞品差距的产品负责人。
- 需要基于事实数据制定研发优先级的工程团队。

### 验收标准

- 可在离线环境稳定运行 L0 硬门禁，并对 hard dimensions 回归给出 deterministic 失败原因。
- L1 自评套件具备可版本化场景与阈值，支持 nightly 产出结构化报告与趋势基线。
- L2 对比套件可统一采集 KnowMe、Cursor、Workbuddy 结果，并按同一 rubric 输出可比报告。
- 评估失败可追溯到“场景 × 维度 × 归因标签”，并可映射为可执行工程任务。
- 文档工件齐全（proposal/design/tasks/qa-plan/acceptance/code-review）且可直接驱动 `/opsx:apply`。

### 非目标（Non-goals）

- 不在本 change 中强制接入在线 LLM-as-a-judge 为硬门禁。
- 不在本 change 中引入外部商业评测平台或计费系统。
- 不在本 change 中替换现有 `npm test` / `npm run lint` 基础门禁。
- 不将“总分”作为唯一目标，避免牺牲安全性、可追溯性与稳定性。

## Capabilities

### New Capabilities

- `agent-competitive-benchmark`: 统一定义跨产品任务、适配器协议、评分与报告产物。

### Modified Capabilities

- `agent-eval-harness`: 从单层回归扩展为分层评估内核，覆盖自评指标体系、场景治理与趋势报告。

## Impact

- 代码：`tests/agent-conversation-eval-harness.js`、`tests/fixtures/agent-conversation-eval/`、`scripts/agent-eval.js`、可能新增 `scripts/agent-benchmark.js` 与适配器模块。
- 测试：新增自评与竞品对比相关测试，保持离线硬门禁可运行。
- 流程：评估报告进入 `openspec/changes/<name>/evidence/`，用于制作人验收与测试 QA。
- 质量治理：形成“评估 -> 归因 -> 优先级 -> 回归验证”的稳定闭环。
