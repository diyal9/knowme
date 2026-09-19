---
type: Metric
title: D1 Retention — 次日留存率
description: 注册日 T 的用户中，在 T+1 仍活跃的用户占比。
tags: [retention, core-kpi, daily]
grain: user_id + register_date
owner: 数据组
status: active
formula: "COUNT(DISTINCT active_d1) / COUNT(DISTINCT register_cohort) WHERE register_date = T"
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
timestamp: 2026-06-17T00:00:00Z
---

# Definition

> **跨项目抽象**（TE 查数勿用模板事件名）。生产 → [百炼](#implementation百炼英雄--生产) / [FF](#implementation指尖战纪-ff--生产) 或各项目 [metric-implementation](/projects/)。

D1 留存 = 在注册日 T 注册的用户中，在 **T+1** 有登录行为（模板 [LoginEvent](/behavioral/events/LoginEvent.md)）的去重用户数 / T 日注册用户数。

# Implementation（百炼英雄 · 生产）

见 [metric-implementation](/projects/temperedheroes/metric-implementation.md)：`t_register` → `t_login`，unitNum=1。

# Implementation（指尖战纪 FF · 生产）

见 [metric-implementation](/projects/fingertipff/metric-implementation.md)：`t_register` → `t_login`，unitNum=1；TE **249**。

# Edge Cases

- **注册事件 vs 首次登录**： cohort 以「注册成功」还是「首次打开」为准，须在项目内统一（常见为注册成功事件，待补 RegisterEvent）。
- **时区切日**：注册日与活跃日须同一统计时区。
- **删号/封禁**：是否从分母剔除需业务裁定。

# Examples

```sql
-- 模板：D1 by channel（表名待对接）
WITH cohort AS (
  SELECT user_id, register_date, channel
  FROM dim_user
  WHERE register_date = '${date}'
),
d1 AS (
  SELECT DISTINCT c.user_id
  FROM cohort c
  JOIN dwd_login_event e ON c.user_id = e.user_id
  WHERE e.event_date = DATE_ADD(c.register_date, INTERVAL 1 DAY)
)
SELECT c.channel,
       COUNT(DISTINCT c.user_id) AS register_cnt,
       COUNT(DISTINCT d1.user_id) AS d1_retained_cnt,
       COUNT(DISTINCT d1.user_id) * 1.0 / NULLIF(COUNT(DISTINCT c.user_id), 0) AS d1_rate
FROM cohort c
LEFT JOIN d1 ON c.user_id = d1.user_id
GROUP BY c.channel;
```

# Industry Reference

- 行业 [次留/2日留存](/references/industry-glossary/retention.md)（cohort：**首日新增**；含休闲/中重度基准值）
- 同 cohort 扩展：[D7 留存](/semantic/metrics/d7_retention.md)
- **open**：[D1/D7 cohort 争议](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) — 本项目 Wiki 以**注册日 T** 为准，项目可 override

# TE Query Hint

1. `build_retention_analysis_qp` → `query_adhoc`（`modelType=retention`）
2. `retention.unitNum: 1`（对应次留 / D1）
3. `initialEvent` / `returnEvent` 须填 TE 项目内事件名（cohort 由 TE 事件定义，可能与 Wiki「注册日 T」不同 → 见 open Conflict）

```json
{
  "retention": {
    "initialEvent": "<注册/首次登录事件名>",
    "returnEvent": "<登录事件名>",
    "unitNum": 1
  }
}
```

详见 [te-mcp-analysis](/references/te-mcp-analysis.md)

# Citations

[1] 本 Concept 为初始化模板；RegisterEvent 与汇总表待 ingest 后补链。
[2] 行业参考：[留存术语手册](/references/industry-glossary/retention.md)（非团队强制口径）
