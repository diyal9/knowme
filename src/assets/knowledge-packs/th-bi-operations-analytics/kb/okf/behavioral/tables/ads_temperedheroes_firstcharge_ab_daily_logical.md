---
type: Data Table
title: ads_temperedheroes_firstcharge_ab_daily_logical — 百炼首充 AB 日应用层
description: 首充档位 AB 实验看板/报告使用的日粒度应用层逻辑表。
resource: logical://temperedheroes/ads/firstcharge_ab_daily_logical
layer: ads
project_id: 69
tags: [temperedheroes, ads, ab-test, first-charge]
owner: 数据组
status: draft
timestamp: 2026-06-18T00:00:00Z
---

# Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| `stat_date` | date | 统计日 |
| `ab_group` | string | 实验组 / 对照组（由 area_id 映射） |
| `area_id` | int | 区服 ID |
| `register_users` | bigint | 新进用户数（`t_register` cohort） |
| `firstcharge_users` | bigint | 首充三档付费用户数 |
| `firstcharge_rate` | double | 首充转化率 = firstcharge_users / register_users |
| `revenue_generalcost` | bigint | 首充流水汇总 |
| `pay_rate` | double | 付费率（护栏 R8） |
| `arpu` | double | ARPU（护栏 R8） |

# Joins

* 来源：[dws_temperedheroes_user_daily_logical](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)
* 过滤规则：[filter-registry § AB](/projects/temperedheroes/filter-registry.md)
* 看板规格：[首充 AB 看板规格](/synthesis/temperedheroes-first-charge-ab-dashboard-spec.md)

# Metrics

* [首充 AB Playbook](/semantic/playbooks/first-charge-tier-ab-test.md) 主 KPI
* [pay_rate](/semantic/metrics/pay_rate.md) · [arpu](/semantic/metrics/arpu.md)（R8 护栏）

# Citations

[1] [首充 AB 第 1 期报告](/synthesis/temperedheroes-first-charge-ab-report-phase1.md)
[2] TE 报表 87751–87758（projectId=101）
