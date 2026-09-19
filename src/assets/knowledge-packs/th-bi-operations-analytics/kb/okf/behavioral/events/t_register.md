---
type: Tracking Event
title: t_register — 注册
description: 百炼英雄用户注册事件（盘古数据中心）。
event_name: t_register
project_id: 69
te_event_id: 39612
tags: [core, acquisition, temperedheroes]
owner: 数据组
status: active
properties:
  - /behavioral/events/properties/platform.md
lands_in:
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
used_by_metrics:
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
timestamp: 2026-06-17T00:00:00Z
---

# Schema（百炼英雄 · 盘古 MCP 核验）

继承 `t_default` 表头（`platform`、`customer_id`、`area_id`、`device_id`、`ftime` 等），以下为 **t_register 专有字段**：

| Property | Type | Enum | Description |
|----------|------|------|-------------|
| `adjustid` | string | — | adjust id |
| `reg_type` | dim | REG_TYPE | 注册类型 |
| `user_source` | string | — | 归因广告商 |
| `ad_name` | string | — | 归因广告位 |
| `opp_uid` | string | — | 邀请人 uid |
| `server_open_time` | string | — | 区服开服时间 |

# Notes

- 微小渠道过滤：`platform = temperedheroes_cn`（TE 用户属性过滤待核对）。
- AB 实验 Cohort：**注册发生在实验窗内** + **`area_id` 区服列表**分流。
- TE 事件名同为 `t_register`。

# Citations

[1] 盘古 MCP `list_event_properties` project_id=69 event_id=586450443039670292（2026-06-18）
