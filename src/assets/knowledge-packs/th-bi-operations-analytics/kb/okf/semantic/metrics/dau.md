---
type: Metric
title: DAU — 日活跃用户
description: 自然日内至少有一次登录行为的去重用户数。
tags: [core-kpi, active, daily]
grain: user_id + stat_date
owner: 数据组
status: active
formula: "COUNT(DISTINCT user_id) WHERE stat_date = T AND has_login = true"
implemented_by:
  - /behavioral/events/LoginEvent.md
  - /behavioral/events/t_login.md
aggregated_from:
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
dimensions:
  - /semantic/dimensions/channel.md
  - /semantic/dimensions/platform.md
te_query_builder: build_event_analysis_qp
te_model_type: event
timestamp: 2026-06-17T00:00:00Z
---

# Definition

> **跨项目抽象**（TE 查数勿用模板事件名 `LoginEvent`）。生产口径 → [百炼](#implementation百炼英雄--生产) / [FF](#implementation指尖战纪-ff--生产) 或各项目 [metric-implementation](/projects/)。

DAU（Daily Active Users）：统计日 T 内，触发登录行为（模板 [LoginEvent](/behavioral/events/LoginEvent.md)）的 **去重 `user_id` 数**。

# Edge Cases

- **时区**：默认按业务统计时区（常见 UTC+8）切日；跨时区项目须在 [platform](/semantic/dimensions/platform.md) 或独立时区维度中说明。
- **游客账号**：是否计入 DAU 需与注册/绑定规则一致；见项目 Segment 约定（待补）。
- **多设备**：同一用户多设备登录仍计 1 人（按 `user_id` 去重）。

# Examples

```sql
-- 模板：按日 DAU（表名待对接实际 dwd/dws）
SELECT stat_date, COUNT(DISTINCT user_id) AS dau
FROM dws_user_active_daily
WHERE stat_date = '${date}'
GROUP BY stat_date;
```

# Implementation（百炼英雄 · 生产）

> **查数以本小节链接为准**：[metric-implementation](/projects/temperedheroes/metric-implementation.md)

| 项 | 百炼 |
|----|------|
| 事件 | **`t_login`**（TE 39613） |
| 去重 | **`customer_id`** |
| TE | `build_event_analysis_qp` · `user_count` |

# Implementation（指尖战纪 FF · 生产）

> **查数以本小节链接为准**：[metric-implementation](/projects/fingertipff/metric-implementation.md)

| 项 | FF |
|----|-----|
| 事件 | **`t_login`**（TE 64147） |
| 去重 | **`customer_id`** |
| TE projectId | **249** |

# Industry Reference

- 行业 [DAU](/references/industry-glossary/acquisition.md)：当日至少登录 1 次的有效账号（不含测试号/机器人）；与本 Wiki LoginEvent 去重口径大体一致，测试号剔除规则由项目裁定。

# TE Query Hint

1. `list_projects` → TE `projectId`
2. `build_event_analysis_qp`（`modelType=event`）示例意图：

```json
{
  "projectId": "<TE projectId>",
  "timeRange": { "mode": "previous", "unit": "day", "value": 7 },
  "metrics": [{ "event": "t_login", "aggregation": "user_count" }],
  "groups": [{ "field": { "name": "渠道", "type": "event_property" } }]
}
```

3. `status=generated` → `query_adhoc`；百炼英雄登录事件 **`t_login`**（见 [t_login](/behavioral/events/t_login.md)）

# Citations

[1] 本 Concept；`aggregated_from` 链 [百炼逻辑表](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)（物理表名待 raw 校准）。
[2] 行业参考：[投放术语手册](/references/industry-glossary/acquisition.md)（非团队强制口径）
