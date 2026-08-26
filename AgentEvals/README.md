# AgentEvals

AgentEvals 是 KnowMe 仓库侧的专家 Agent 评估基建，只评估项目中的 Agent 资产与可选的任务表现数据，不属于 KnowMe 产品运行时功能。

## 快速开始

```bash
npm run agent-evals
npm run agent-evals -- --json
npm run agent-evals -- --out AgentEvals/reports/latest
```

默认扫描 `src/catalog/experts/`，生成每个专家的设计分、问题清单和总体汇总。

## 评分层级

- 设计分（0～100）：身份、输入输出契约、边界、技能装配、证据/知识策略、包完整性。
- 运行表现分（可选）：从 `--results` 导入任务结果后，按完成度、质量、证据、效率和匹配度评分。
- 综合分：有运行样本时采用 `70% 运行表现 + 30% 设计分`；没有运行样本时只展示设计分，并标记“未验证”。

评分细则见 [rubric.md](rubric.md)，结果格式见 [schemas/runtime-results.schema.json](schemas/runtime-results.schema.json)。

## 评估原则

- 不把没有真实数据源或连接器授权归咎于专家包；连接器只检查声明是否有效。
- 不使用模型自评作为主要分数。
- 没有运行样本时不伪造表现分。
- `external-capability-importer` 是运维型 Agent，技能为空属于明确例外，但仍检查其职责、边界和导入规程。
