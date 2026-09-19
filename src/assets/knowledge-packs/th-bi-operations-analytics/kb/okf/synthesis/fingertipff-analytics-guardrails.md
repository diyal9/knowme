---
type: Synthesis
title: 指尖战纪 FF — 分析门禁（防乱报）
description: Agent / 数据组在 FF（TE 249）作答与出数时必须遵守的红线；多项目并存时防 TH 口径污染。
tags: [fingertipff, guardrails, accuracy, policy, multi-project]
project_id: 82
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# 原则

**宁可说「查不到 / 待确认」，不可把百炼口径、模板或猜测当 FF 事实。**

# 作答前必确认

| # | 项 | 未确认时 |
|---|-----|----------|
| 1 | 项目 = FF（盘古 **82** / TE **249** / slug **fingertipff**） | 禁止给 FF 具体数字 |
| 2 | **时间范围** + **业务日时区** | 禁止 `query_adhoc` |
| 3 | 指标来自 [metric-implementation](/projects/fingertipff/metric-implementation.md) | 禁止自创 cohort / 事件名 |
| 4 | 过滤器来自 [filter-registry](/projects/fingertipff/filter-registry.md) | 「平台」须 Slot 消歧 |
| 5 | 事件名 = **`t_register` / `t_login` / `t_pay_flow`** | 禁止用 `LoginEvent` 模板名 |
| 6 | 金额字段 = **`cost`**（非百炼 `generalcost`） | 报「元」可用 `#vp@cost_yuan` |
| 7 | 跨项目对照 | 读 [field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md) |

# 禁止行为（含多项目 P0）

1. **禁止**用百炼 **`area_id`** 列表过滤 FF 数据
2. **禁止**假设盘古 project_id = TE projectId
3. **禁止** Session 从百炼切到 FF 时沿用旧 `filters[]`
4. **禁止**用百炼 `platform=temperedheroes_cn` 等枚举套 FF
5. **禁止**在未确认时区与金额口径时向业务报确定「元」数值（`cost_yuan` 可用但仍建议财务签收）
6. **禁止**未锁项目或 `confirmed_by_user=false` 时 `query_adhoc`

# 允许 / 推荐

| 场景 | 做法 |
|------|------|
| 查定义 | metric-implementation + filter-registry |
| 查数字 | TE `build_*_analysis_qp` → `query_adhoc`；附 QP 摘要 |
| 查协议 | 盘古 MCP（project_id 确认后）/ TE `list_properties` |
| 换项目 | F-4 重选 → 重读 FF 三本（index / filter-registry / metric-implementation） |

# 输出格式（带数答案）

```
项目：fingertipff（TE 249）
时间：{range}（时区：{tz 或「待确认」}）
口径：{metric-implementation 摘要}
过滤器：{slot 列表或「无」}
结果：{数值}
依据：TE query_adhoc / 报表 ID
```

# Citations

[1] [multi-project-operating-guide](/synthesis/multi-project-operating-guide.md)
[2] [temperedheroes guardrails](/synthesis/temperedheroes-analytics-guardrails.md)
