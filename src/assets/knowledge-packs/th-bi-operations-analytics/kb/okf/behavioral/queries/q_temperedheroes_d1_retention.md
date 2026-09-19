---
type: Query Template
title: q_temperedheroes_d1_retention — 百炼 D1 留存
description: 注册日 T cohort，T+1 登录回访的 D1 留存 SQL 模板。
project_id: 69
tags: [temperedheroes, retention, d1, sql]
owner: 数据组
status: draft
metrics:
  - /semantic/metrics/d1_retention.md
tables:
  - /behavioral/tables/dim_temperedheroes_user_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
timestamp: 2026-06-18T00:00:00Z
---

# 口径

Cohort = **`t_register` 注册日 T**；回访 = **T+1 有 `t_login`**。与 [d1_retention](/semantic/metrics/d1_retention.md) · [metric-implementation](/projects/temperedheroes/metric-implementation.md) 一致。

# Examples

```sql
WITH cohort AS (
  SELECT customer_id, register_date, area_id, platform
  FROM dim_temperedheroes_user_logical
  WHERE register_date = '${date}'
),
d1 AS (
  SELECT DISTINCT c.customer_id
  FROM cohort c
  JOIN dwd_temperedheroes_event_logical e
    ON c.customer_id = e.customer_id
   AND e.event_name = 't_login'
   AND DATE(e.ftime) = DATE_ADD(c.register_date, INTERVAL 1 DAY)
)
SELECT c.area_id,
       COUNT(DISTINCT c.customer_id) AS register_cnt,
       COUNT(DISTINCT d1.customer_id) AS d1_retained_cnt,
       COUNT(DISTINCT d1.customer_id) * 1.0 / NULLIF(COUNT(DISTINCT c.customer_id), 0) AS d1_rate
FROM cohort c
LEFT JOIN d1 ON c.customer_id = d1.customer_id
GROUP BY c.area_id;
```

# Citations

[1] [d1_retention](/semantic/metrics/d1_retention.md)
[2] [dim 用户逻辑表](/behavioral/tables/dim_temperedheroes_user_logical.md)
