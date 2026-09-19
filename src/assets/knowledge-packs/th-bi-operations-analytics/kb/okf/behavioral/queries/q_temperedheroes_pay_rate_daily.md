---
type: Query Template
title: q_temperedheroes_pay_rate_daily — 百炼日付费率
description: 日付费用户数 / 日活跃用户数。
project_id: 69
tags: [temperedheroes, monetization, pay-rate, sql]
owner: 数据组
status: draft
metrics:
  - /semantic/metrics/pay_rate.md
tables:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
timestamp: 2026-06-18T00:00:00Z
---

# 口径

`pay_rate = payers / actives`；事件 **`t_pay_flow`** / **`t_login`**。见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)。

# Examples

```sql
SELECT stat_date,
       COUNT(DISTINCT CASE WHEN is_payer = 1 THEN customer_id END) AS payers,
       COUNT(DISTINCT CASE WHEN is_active = 1 THEN customer_id END) AS actives,
       COUNT(DISTINCT CASE WHEN is_payer = 1 THEN customer_id END) * 1.0
         / NULLIF(COUNT(DISTINCT CASE WHEN is_active = 1 THEN customer_id END), 0) AS pay_rate
FROM dws_temperedheroes_user_daily_logical
WHERE stat_date = '${date}'
GROUP BY stat_date;
```

# Citations

[1] [pay_rate](/semantic/metrics/pay_rate.md)
