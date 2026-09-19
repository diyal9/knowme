---
type: Metric
title: D7 Retention — 7日留存率
description: 注册日 T 的用户中，在 T+7 仍活跃的用户占比。
tags: [retention, core-kpi, weekly]
grain: user_id + register_date
owner: 数据组
status: active
formula: "COUNT(DISTINCT active_d7) / COUNT(DISTINCT register_cohort) WHERE register_date = T"
implemented_by:
  - /behavioral/events/LoginEvent.md
  - /behavioral/events/t_register.md
  - /behavioral/events/t_login.md
aggregated_from:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dim_temperedheroes_user_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
dimensions:
  - /semantic/dimensions/channel.md
  - /semantic/dimensions/platform.md
te_query_builder: build_retention_analysis_qp
te_model_type: retention
te_retention_unit_num: 7
timestamp: 2026-06-17T14:00:00Z
---

# Definition

> **跨项目抽象**（TE 查数勿用模板事件名）。生产 → [百炼](#implementation百炼英雄--生产) / [FF](#implementation指尖战纪-ff--生产) 或各项目 [metric-implementation](/projects/)。

D7 留存（7留）= 在注册日 T 注册的用户中，在 **T+7** 有登录行为（模板 [LoginEvent](/behavioral/events/LoginEvent.md)）的去重用户数 / T 日注册用户数。

与 [D1 留存](/semantic/metrics/d1_retention.md) 共用同一 cohort 定义；仅活跃观测日不同（T+7 vs T+1）。

# Implementation（百炼英雄 · 生产）

见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)：`t_register` → `t_login`，unitNum=7。

# Implementation（指尖战纪 FF · 生产）

见 [metric-implementation](/projects/fingertipff/metric-implementation.md)：`t_register` → `t_login`，unitNum=7；TE **249**。

# Edge Cases

- **cohort 定义**：与 D1 相同，默认 **注册日 T**；行业参考常用「首日新增」，见 open [Conflict](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md)。
- **第 7 天计数**：T+7 指注册日后第 7 个自然日（非满 7×24 小时），须与 D1/D3 等留存报表一致。
- **时区切日**：注册日与 T+7 活跃日须同一统计时区。
- **删号/封禁**：是否从分母剔除需业务裁定。

# Examples

```sql
-- 模板：D7 by channel（表名待对接）
WITH cohort AS (
  SELECT user_id, register_date, channel
  FROM dim_user
  WHERE register_date = '${date}'
),
d7 AS (
  SELECT DISTINCT c.user_id
  FROM cohort c
  JOIN dwd_login_event e ON c.user_id = e.user_id
  WHERE e.event_date = DATE_ADD(c.register_date, INTERVAL 7 DAY)
)
SELECT c.channel,
       COUNT(DISTINCT c.user_id) AS register_cnt,
       COUNT(DISTINCT d7.user_id) AS d7_retained_cnt,
       COUNT(DISTINCT d7.user_id) * 1.0 / NULLIF(COUNT(DISTINCT c.user_id), 0) AS d7_rate
FROM cohort c
LEFT JOIN d7 ON c.user_id = d7.user_id
GROUP BY c.channel;
```

# Industry Reference

- 行业 [7留](/references/industry-glossary/retention.md)（cohort：**首日新增**；行业基准：休闲优秀≥15%/合格≥10%，中重度优秀≥20%/合格≥15%）
- **open**：[D1/D7 cohort 争议](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) — 本项目 Wiki 以**注册日 T** 为准，项目可 override

# TE Query Hint

1. `build_retention_analysis_qp` → `query_adhoc`（`modelType=retention`）
2. `retention.unitNum: 7`（7留；TE 为 day-7 retention interval）
3. 下钻：`drilldown_users` 传 `retentionDays: 7`（来自 `query_adhoc` 结果，勿猜测）

```json
{
  "retention": {
    "initialEvent": "<注册/首次登录事件名>",
    "returnEvent": "<登录事件名>",
    "unitNum": 7
  }
}
```

Wiki 定义为 **T+7 自然日**；TE cohort 取决于 `initialEvent`，结果不一致时见 [te-analysis-policy](/synthesis/te-analysis-policy.md)。

# Citations

[1] 本 Concept 为初始化模板；RegisterEvent 与汇总表待 ingest 后补链。
[2] 行业参考：[留存术语手册](/references/industry-glossary/retention.md)（非团队强制口径）
