---
type: Metric
title: Pay Rate — 付费率
description: 统计日内付费用户数占活跃用户数的比例。
tags: [monetization, core-kpi, daily]
grain: user_id + stat_date
owner: 数据组
status: active
formula: "COUNT(DISTINCT pay_user) / COUNT(DISTINCT active_user) WHERE stat_date = T"
implemented_by:
  - /behavioral/events/LoginEvent.md
  - /behavioral/events/t_login.md
  - /behavioral/events/t_pay_flow.md
  - /behavioral/events/PayEvent.md
aggregated_from:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md
dimensions:
  - /semantic/dimensions/channel.md
  - /semantic/dimensions/platform.md
te_query_builder: build_event_analysis_qp
te_model_type: event
timestamp: 2026-06-17T00:00:00Z
---

# Definition

> **跨项目抽象**（TE 查数勿用 `PayEvent` / `LoginEvent` 模板名）。生产 → [百炼](#implementation百炼英雄--生产) / [FF](#implementation指尖战纪-ff--生产) 或各项目 [metric-implementation](/projects/)。

付费率 = 统计日 T 内发生付费行为（模板 [PayEvent](/behavioral/events/PayEvent.md)）的去重用户数 / 同日 [DAU](/semantic/metrics/dau.md)（或同期活跃 cohort，须与报表一致）。

# Implementation（百炼英雄 · 生产）

见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)：`t_pay_flow` 用户 / `t_login` 用户；事件名非 PayEvent/LoginEvent 模板。

# Implementation（指尖战纪 FF · 生产）

见 [metric-implementation](/projects/fingertipff/metric-implementation.md)：`t_pay_flow` / `t_login`；TE **249**。

# Edge Cases

- **分子分母时间窗**：须同为自然日 T；退款是否回滚付费用户需单独约定。
- **小额/测试订单**：是否过滤测试渠道或内部账号。
- **与 ARPU 关系**：Pay Rate × [ARPPU](/references/industry-glossary/monetization.md) ≈ [ARPU](/semantic/metrics/arpu.md)（须同一周期与活跃定义）。

# Examples

```sql
-- 模板（表名待对接）
SELECT stat_date,
       COUNT(DISTINCT CASE WHEN is_payer THEN user_id END) * 1.0
         / NULLIF(COUNT(DISTINCT user_id), 0) AS pay_rate
FROM dws_user_daily
WHERE stat_date = '${date}'
GROUP BY stat_date;
```

# Industry Reference

- 行业 [付费率/付费渗透率](/references/industry-glossary/monetization.md)：付费用户数 / 同期活跃用户数；与本 Wiki PayEvent/DAU 定义一致，退款与测试订单剔除由项目裁定。

# TE Query Hint

付费率 = 付费用户 / 活跃用户，可用 **公式指标** 或两次 `user_count`：

```json
{
  "metrics": [{
    "formula": "payers/actives",
    "dependencies": [
      { "alias": "payers", "event": "<付费事件>", "aggregation": "user_count" },
      { "alias": "actives", "event": "<登录事件>", "aggregation": "user_count" }
    ]
  }]
}
```

`build_event_analysis_qp` → `query_adhoc`；详见 [te-mcp-analysis](/references/te-mcp-analysis.md)

# Citations

[1] 初始化模板；与财务口径对齐待 ingest。
[2] 行业参考：[付费术语手册](/references/industry-glossary/monetization.md)（非团队强制口径）
