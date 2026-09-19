---
type: Tracking Event
title: LoginEvent
description: 用户登录成功时上报的元事件。
event_name: LoginEvent
tags: [core, login, dau]
owner: 数据组
status: draft
properties:
  - /behavioral/events/properties/platform.md
  - /behavioral/events/properties/channel.md
lands_in:
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
used_by_metrics:
  - /semantic/metrics/dau.md
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
timestamp: 2026-06-17T00:00:00Z
---

# Schema

| Property | Type | Dimension | Description |
|----------|------|-----------|-------------|
| `user_id` | string | — | 用户唯一标识 |
| `platform` | string | [platform](/semantic/dimensions/platform.md) | 客户端平台 |
| `channel` | string | [channel](/semantic/dimensions/channel.md) | 登录渠道 |
| `event_time` | timestamp | — | 事件发生时间 |

# Project Mapping

| 项目 | 生产事件名 | Wiki |
|------|-----------|------|
| 百炼英雄（project_id=69） | **`t_login`** | [t_login](/behavioral/events/t_login.md) |
| 指尖战纪 FF（盘古 82 / TE 249） | **`t_login`** | [metric-implementation](/projects/fingertipff/metric-implementation.md) |

本页为**跨项目通用模板**；TE 查数须用各项目生产事件名（如 `t_login`），勿用 `LoginEvent`。

# Notes

- LoginEvent 是 [DAU](/semantic/metrics/dau.md)、[D1/D7 留存](/semantic/metrics/d1_retention.md) 与 [ARPU](/semantic/metrics/arpu.md) 分母的行为层锚点（模板层）。
- 实际属性列表以盘古数据中心 `list_event_properties` 为准；ingest 后更新本表。

# Citations

[1] 初始化模板；待 MCP 拉取正式协议后修订。
