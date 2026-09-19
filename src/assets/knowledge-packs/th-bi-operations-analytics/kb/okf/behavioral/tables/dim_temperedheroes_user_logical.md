---
type: Data Table
title: dim_temperedheroes_user_logical — 百炼用户维度逻辑表
description: 用户注册 cohort 与基础属性维度逻辑层，供留存/付费分析 join。
resource: logical://temperedheroes/dim/user_logical
layer: dim
project_id: 69
tags: [temperedheroes, dim, user, cohort]
owner: 数据组
status: draft
timestamp: 2026-06-18T00:00:00Z
---

# Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| `customer_id` | string | 用户唯一标识 |
| `register_date` | date | 注册日 T（来自首次 `t_register`） |
| `first_register_time` | datetime | 首次注册事件时间 |
| `area_id` | int | 注册区服 |
| `platform` | string | 事件 platform（t_default） |
| `package` | int | 渠道包 PACKAGE_TYPE |
| `os` | string | 客户端 OS |

# Joins

* 来源：[dwd_temperedheroes_event_logical](/behavioral/tables/dwd_temperedheroes_event_logical.md)（`event_name='t_register'` 取首次）
* 用于：[D1/D7 留存](/semantic/metrics/d1_retention.md) cohort 分母

# Citations

[1] [metric-implementation](/projects/temperedheroes/metric-implementation.md) — cohort = `t_register` 注册日
[2] 盘古 MCP `t_default` 表头（2026-06-18）
