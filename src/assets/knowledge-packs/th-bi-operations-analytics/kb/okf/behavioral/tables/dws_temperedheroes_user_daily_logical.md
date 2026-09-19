---
type: Data Table
title: dws_temperedheroes_user_daily_logical — 百炼用户日聚合逻辑表
description: 以用户-自然日为粒度的活跃、留存、付费聚合逻辑层。
resource: logical://temperedheroes/dws/user_daily_logical
layer: dws
project_id: 69
tags: [temperedheroes, dws, user-daily, logical]
owner: 数据组
status: draft
timestamp: 2026-06-18T00:00:00Z
---

# Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| `stat_date` | date | 统计日 |
| `customer_id` | string | 用户 ID |
| `is_register` | tinyint | 当日是否注册 |
| `is_active` | tinyint | 当日是否活跃（有登录） |
| `is_payer` | tinyint | 当日是否付费 |
| `revenue_generalcost` | bigint | 当日支付金额汇总 |
| `area_id` | int | 区服 ID |
| `platform` | string | 平台/渠道 |

# Joins

* 来源表：[dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)
* 下游：[ads_temperedheroes_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md)
* 常用指标：
  * [DAU](/semantic/metrics/dau.md)
  * [D1 Retention](/semantic/metrics/d1_retention.md)
  * [D7 Retention](/semantic/metrics/d7_retention.md)
  * [Pay Rate](/semantic/metrics/pay_rate.md)
  * [ARPU](/semantic/metrics/arpu.md)

# Citations

[1] [百炼生产指标实现](/projects/temperedheroes/metric-implementation.md)
