---
type: Query Template
title: q_temperedheroes_ab_firstcharge_core_kpis — 百炼首充 AB 核心指标模板
description: 生成首充 AB 的核心指标（样本、新充转化、流水、付费率、ARPU）。
project_id: 69
tags: [temperedheroes, abtest, first-charge, pay-rate, arpu, sql-template]
owner: 数据组
status: active
timestamp: 2026-06-18T00:00:00Z
---

# Definition

按 AB 组别（日粒度）输出 R1/R2/R3/R8 核心指标。过滤规则以 [filter-registry](/projects/temperedheroes/filter-registry.md) 为准。

# Joins

* 事件来源：[t_register](/behavioral/events/t_register.md)、[t_login](/behavioral/events/t_login.md)、[t_pay_flow](/behavioral/events/t_pay_flow.md)
* 表依赖：[dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)
* 应用层表：[ads_temperedheroes_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md)
* 对应产出：[首充 AB 报告第 1 期](/synthesis/temperedheroes-first-charge-ab-report-phase1.md)

# Examples

```sql
WITH reg AS (
  SELECT
    stat_date,
    customer_id,
    CASE
      WHEN area_id IN (9993,9995,9997,9999,10001,10003,10005,10007,10009) THEN 'test'
      WHEN area_id IN (9994,9996,9998,10000,10002,10004,10006,10008,10010) THEN 'control'
      ELSE 'other'
    END AS grp
  FROM dwd_temperedheroes_event_logical
  WHERE event_name = 't_register'
    AND stat_date BETWEEN '${start_date}' AND '${end_date}'
),
pay AS (
  SELECT stat_date, customer_id, grp, generalcost, gift_pack_id
  FROM (
    SELECT
      e.stat_date,
      e.customer_id,
      CASE
        WHEN e.area_id IN (9993,9995,9997,9999,10001,10003,10005,10007,10009) THEN 'test'
        WHEN e.area_id IN (9994,9996,9998,10000,10002,10004,10006,10008,10010) THEN 'control'
        ELSE 'other'
      END AS grp,
      e.generalcost,
      e.gift_pack_id
    FROM dwd_temperedheroes_event_logical e
    WHERE e.event_name = 't_pay_flow'
      AND e.stat_date BETWEEN '${start_date}' AND '${end_date}'
  ) t
),
login_u AS (
  SELECT stat_date, customer_id,
         CASE
           WHEN area_id IN (9993,9995,9997,9999,10001,10003,10005,10007,10009) THEN 'test'
           WHEN area_id IN (9994,9996,9998,10000,10002,10004,10006,10008,10010) THEN 'control'
           ELSE 'other'
         END AS grp
  FROM dwd_temperedheroes_event_logical
  WHERE event_name = 't_login'
    AND stat_date BETWEEN '${start_date}' AND '${end_date}'
)
SELECT
  r.stat_date,
  r.grp,
  COUNT(DISTINCT r.customer_id) AS new_users,
  COUNT(DISTINCT CASE WHEN p.gift_pack_id IN (400104,400105,400106) THEN p.customer_id END) AS first_charge_users,
  SUM(CASE WHEN p.gift_pack_id IN (400104,400105,400106) THEN p.generalcost ELSE 0 END) AS first_charge_revenue,
  COUNT(DISTINCT p.customer_id) AS pay_users,
  COUNT(DISTINCT l.customer_id) AS active_users,
  COUNT(DISTINCT p.customer_id) * 1.0 / NULLIF(COUNT(DISTINCT l.customer_id), 0) AS pay_rate,
  SUM(COALESCE(p.generalcost, 0)) * 1.0 / NULLIF(COUNT(DISTINCT l.customer_id), 0) AS arpu
FROM reg r
LEFT JOIN pay p ON r.customer_id = p.customer_id AND r.grp = p.grp AND r.stat_date = p.stat_date
LEFT JOIN login_u l ON r.customer_id = l.customer_id AND r.grp = l.grp AND r.stat_date = l.stat_date
WHERE r.grp IN ('test', 'control')
GROUP BY r.stat_date, r.grp
ORDER BY r.stat_date, r.grp;
```

# Citations

[1] [Filter Slot 注册表](/projects/temperedheroes/filter-registry.md)
[2] [百炼生产指标实现](/projects/temperedheroes/metric-implementation.md)
[3] [platform vs area_id Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)
