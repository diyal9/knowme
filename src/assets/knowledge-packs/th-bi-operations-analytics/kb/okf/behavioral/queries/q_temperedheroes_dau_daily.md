---
type: Query Template
title: q_temperedheroes_dau_daily — 百炼日 DAU
description: 基于 DWS 用户日表或 DWD 登录事件的日 DAU 查询模板。
project_id: 69
tags: [temperedheroes, dau, sql]
owner: 数据组
status: draft
metrics:
  - /semantic/metrics/dau.md
tables:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
timestamp: 2026-06-18T00:00:00Z
---

# 口径

自然日 `stat_date` 内 **`t_login`** 去重 **`customer_id`**。生产 TE 口径见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)。

# Examples

## 方案 A — DWS 预聚合

```sql
SELECT stat_date,
       COUNT(DISTINCT customer_id) AS dau
FROM dws_temperedheroes_user_daily_logical   -- 物理表名待替换
WHERE stat_date = '${date}'
  AND is_active = 1
GROUP BY stat_date;
```

## 方案 B — DWD 明细

```sql
SELECT DATE(ftime) AS stat_date,
       COUNT(DISTINCT customer_id) AS dau
FROM dwd_temperedheroes_event_logical        -- 物理表名待替换
WHERE event_name = 't_login'
  AND stat_date = '${date}'
GROUP BY DATE(ftime);
```

# Citations

[1] [dau Metric](/semantic/metrics/dau.md)
[2] [dws 逻辑表](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)
