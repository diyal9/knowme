---
type: Query Template
title: q_temperedheroes_retention_d1d7 — 百炼 D1/D7 留存模板
description: 基于 t_register cohort 与 t_login 回访计算 D1/D7 留存。
project_id: 69
tags: [temperedheroes, retention, d1, d7, sql-template]
owner: 数据组
status: active
timestamp: 2026-06-18T00:00:00Z
---

# Definition

百炼生产留存口径：cohort 为 `t_register` 当日注册用户，回访为 `t_login`。

# Joins

* 事件来源：[t_register](/behavioral/events/t_register.md)、[t_login](/behavioral/events/t_login.md)
* 表依赖：[dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)
* 对应指标：[D1 Retention](/semantic/metrics/d1_retention.md)、[D7 Retention](/semantic/metrics/d7_retention.md)

# Examples

```sql
WITH reg AS (
  SELECT customer_id, stat_date AS register_date, platform
  FROM dwd_temperedheroes_event_logical
  WHERE event_name = 't_register'
    AND stat_date BETWEEN '${start_date}' AND '${end_date}'
),
login_d AS (
  SELECT DISTINCT customer_id, stat_date
  FROM dwd_temperedheroes_event_logical
  WHERE event_name = 't_login'
)
SELECT
  r.register_date,
  r.platform,
  COUNT(DISTINCT r.customer_id) AS reg_users,
  COUNT(DISTINCT CASE WHEN d1.customer_id IS NOT NULL THEN r.customer_id END) AS d1_users,
  COUNT(DISTINCT CASE WHEN d7.customer_id IS NOT NULL THEN r.customer_id END) AS d7_users,
  COUNT(DISTINCT CASE WHEN d1.customer_id IS NOT NULL THEN r.customer_id END) * 1.0
    / NULLIF(COUNT(DISTINCT r.customer_id), 0) AS d1_retention,
  COUNT(DISTINCT CASE WHEN d7.customer_id IS NOT NULL THEN r.customer_id END) * 1.0
    / NULLIF(COUNT(DISTINCT r.customer_id), 0) AS d7_retention
FROM reg r
LEFT JOIN login_d d1
  ON r.customer_id = d1.customer_id
 AND d1.stat_date = DATE_ADD(r.register_date, INTERVAL 1 DAY)
LEFT JOIN login_d d7
  ON r.customer_id = d7.customer_id
 AND d7.stat_date = DATE_ADD(r.register_date, INTERVAL 7 DAY)
GROUP BY r.register_date, r.platform
ORDER BY r.register_date, r.platform;
```

# Citations

[1] [百炼生产指标实现](/projects/temperedheroes/metric-implementation.md)
[2] [D1/D7 cohort Conflict](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md)
