# AgentEvals Rubric v1

## 设计分

| 维度 | 权重 | 检查内容 |
|---|---:|---|
| identity | 20 | name、description、useCases 是否清晰 |
| contract | 20 | inputContract、outputContract 是否存在且具体 |
| boundaries | 15 | 是否声明能力边界和风险边界 |
| skills | 20 | 是否绑定有效技能；技能是否与职责有语义关联 |
| grounding | 15 | 是否声明证据、资料、数据、来源或不确定性策略 |
| package | 10 | EXPERT.md、manifest、版本和 ID 是否一致 |

每项按 0～100 计算，再乘以权重。问题分级：

- error：包不可用、ID 不一致、引用不存在。
- warning：能力可以运行，但设计信息不足或缺少专业装配。
- info：可优化项，不影响当前运行。

## 运行表现分

| 维度 | 权重 |
|---|---:|
| completion | 30 |
| quality | 25 |
| evidence | 20 |
| efficiency | 15 |
| fit | 10 |

每项输入 0～100。未提供的维度不自动补高分，而是按可用维度重新归一化，并记录缺失字段。

## 综合分和置信度

```text
综合分 = 设计分                         （无运行样本）
综合分 = 设计分 × 30% + 运行表现分 × 70% （有运行样本）
```

运行表现分使用收缩展示，避免单次任务造成极端排名：

```text
展示表现分 = n / (n + 5) × 实际表现分 + 5 / (n + 5) × 70
```

置信度：0 次为 `unverified`，1～2 次为 `low`，3～5 次为 `medium`，6 次以上为 `high`。
