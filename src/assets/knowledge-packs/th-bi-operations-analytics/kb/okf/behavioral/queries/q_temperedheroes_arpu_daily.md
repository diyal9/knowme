---
type: Query Template
title: q_temperedheroes_arpu_daily — 百炼日 ARPU
description: sum(generalcost) / 活跃用户数。
project_id: 69
tags: [temperedheroes, monetization, arpu, sql]
owner: 数据组
status: draft
metrics:
  - /semantic/metrics/arpu.md
tables:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
timestamp: 2026-06-18T00:00:00Z
---

# 口径

分子 = **`sum(generalcost)`**（`t_pay_flow`）；分母 = **`t_login` user_count**。金额单位 **待财务确认** → [readiness §P0](/projects/temperedheroes/analytics-readiness.md)。

# Examples

```sql
SELECT stat_date,
       SUM(revenue_generalcost) AS revenue,
       COUNT(DISTINCT CASE WHEN is_active = 1 THEN customer_id END) AS actives,
       SUM(revenue_generalcost) * 1.0
         / NULLIF(COUNT(DISTINCT CASE WHEN is_active = 1 THEN customer_id END), 0) AS arpu
FROM dws_temperedheroes_user_daily_logical
WHERE stat_date = '${date}'
GROUP BY stat_date;
```

# Citations

[1] [arpu](/semantic/metrics/arpu.md)
[2] [t_pay_flow](/behavioral/events/t_pay_flow.md)
