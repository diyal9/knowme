---
type: Metric
title: ARPU — 每活跃用户平均付费
description: 统计周期内游戏总流水除以同期活跃用户数，衡量活跃用户平均付费贡献。
tags: [monetization, core-kpi, revenue]
grain: stat_period + user_id (active)
owner: 数据组
status: active
formula: "SUM(pay_amount) / COUNT(DISTINCT active_user) WHERE stat_period = P"
implemented_by:
  - /behavioral/events/PayEvent.md
  - /behavioral/events/t_pay_flow.md
  - /behavioral/events/LoginEvent.md
  - /behavioral/events/t_login.md
aggregated_from:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md
dimensions:
  - /semantic/dimensions/channel.md
  - /semantic/dimensions/platform.md
te_query_builder: build_event_analysis_qp
te_model_type: event
timestamp: 2026-06-17T14:00:00Z
---

# Definition

> **跨项目抽象**（TE 查数勿用 `PayEvent` / `LoginEvent` 模板名）。生产 → [百炼](#implementation百炼英雄--生产) / [FF](#implementation指尖战纪-ff--生产) 或各项目 [metric-implementation](/projects/)。

ARPU（Average Revenue Per User）= 统计周期 P 内付费流水（模板 [PayEvent](/behavioral/events/PayEvent.md)）合计 / 同期 [DAU](/semantic/metrics/dau.md) 口径下的活跃去重用户数。

- **分子**：周期内充值流水（税前、未扣渠道分成；是否含退款回滚须与财务对齐）
- **分母**：同期至少 1 次登录行为（模板 [LoginEvent](/behavioral/events/LoginEvent.md)）的去重 `user_id`
- **周期 P**：常见为自然日 / 自然周 / 自然月；日报与月报 ARPU 不可直接对比

# Implementation（百炼英雄 · 生产）

见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)：`sum(generalcost)` / `t_login` user_count；**单位待财务确认**。

# Implementation（指尖战纪 FF · 生产）

见 [metric-implementation](/projects/fingertipff/metric-implementation.md)：`sum(cost)` / `t_login` user_count；**单位待财务确认**；TE **249**。

# Edge Cases

- **与 ARPPU 区分**：ARPPU 分母为付费用户；ARPU 分母为全部活跃用户。
- **与 [付费率](/semantic/metrics/pay_rate.md) 关系**：同一周期、同一活跃定义下，Pay Rate × ARPPU ≈ ARPU（严格相等需分子分母 cohort 完全一致）。
- **流水口径**：行业参考用「总流水」；财务「分成收入/净收入」见 [monetization 术语](/references/industry-glossary/monetization.md)，项目须单独约定。
- **0 氪用户**：计入分母（活跃用户），不计入分子。
- **测试订单 / 内部账号**：是否剔除须项目裁定。

# Examples

```sql
-- 模板：按日 ARPU by platform（表名待对接）
SELECT stat_date,
       platform,
       SUM(pay_amount) AS revenue,
       COUNT(DISTINCT user_id) AS active_users,
       SUM(pay_amount) * 1.0 / NULLIF(COUNT(DISTINCT user_id), 0) AS arpu
FROM dws_user_daily
WHERE stat_date = '${date}'
GROUP BY stat_date, platform;
```

# Industry Reference

- 行业 [ARPU](/references/industry-glossary/monetization.md)：统计周期内总流水 / 同期活跃用户；基准：休闲均值 5–20 元，中重度 20–100 元，优秀≥150 元（**行业参考，非项目 KPI 目标**）

# TE Query Hint

ARPU 通常用 **event 公式指标**（项目 saved metric 若有则优先）：

1. `build_event_analysis_qp` → 分子：`sum` / `avg_per_user` on 付费事件金额属性；分母：登录事件 `user_count`
2. 或单公式：`formula` + `dependencies`（见 builder schema）

```json
{
  "metrics": [{
    "formula": "revenue/active_users",
    "dependencies": [
      { "alias": "revenue", "event": "<付费事件>", "aggregation": "sum", "property": "<金额属性>" },
      { "alias": "active_users", "event": "<登录事件>", "aggregation": "user_count" }
    ]
  }]
}
```

3. 周期须与用户问法一致（日 ARPU 勿用月活分母）；与 [DAU](/semantic/metrics/dau.md) 分母定义对齐

# Citations

[1] 初始化模板；汇总表与 `amount` 币种单位待 ingest 后补链。
[2] 行业参考：[付费术语手册](/references/industry-glossary/monetization.md)（非团队强制口径）
