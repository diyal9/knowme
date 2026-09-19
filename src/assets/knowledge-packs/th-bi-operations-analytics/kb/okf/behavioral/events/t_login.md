---
type: Tracking Event
title: t_login — 登录
description: 百炼英雄用户登录事件（盘古数据中心 · 登录表）。
event_name: t_login
pango_event_id: "586450443039670297"
project_id: 69
te_event_id: 39613
tags: [core, login, dau, temperedheroes]
owner: 数据组
status: active
table_header: t_default
properties:
  - /behavioral/events/properties/platform.md
lands_in:
  - /behavioral/tables/dwd_temperedheroes_event_logical.md
  - /behavioral/tables/dws_temperedheroes_user_daily_logical.md
  - /behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md
used_by_metrics:
  - /semantic/metrics/dau.md
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
aliases:
  - /behavioral/events/LoginEvent.md
timestamp: 2026-06-18T00:00:00Z
---

# Schema（百炼英雄 · 盘古 MCP 核验）

继承 `t_default` 表头字段（`platform`、`customer_id`、`area_id`、`device_id`、`ftime` 等），以下为 **t_login 专有字段**：

| Property | Type | Enum | Description |
|----------|------|------|-------------|
| `user_abtype` | int | — | 用户 abtest 类型 |
| `adjustid` | string | — | adjust id |
| `is_open_push` | int | — | 是否开启推送 |
| `login_way` | dim | LOGIN_WAY_TYPE | 登录类型 |
| `user_source` | string | — | 归因广告商 |
| `ad_name` | string | — | 归因广告位 |
| `user_name` | string | — | 玩家名字 |
| `combat_power` | int | — | 当前战斗力 |
| `server_id` | int | — | 服务器 ID |
| `is_reflow` | int | — | 是否符合回流条件 |
| `extra_msg` | string | — | 额外参数（如绑定手机） |
| `alliance_id` | string | — | 联盟 id |
| `is_retain` | int | — | 是否分配至新服 |
| `retain_info` | string | — | 回流玩家服务器分配参数 |

# Notes

- 百炼英雄 **DAU / 留存分母** 在 TE 侧使用事件名 **`t_login`**（非通用模板 `LoginEvent`）。
- TE `eventId=39613`；与盘古 `event_name` 一致。
- 微小渠道过滤：`platform = temperedheroes_cn`（用户属性过滤待与数据组核对，见首充 AB 报告）。
- AB 实验区服分流字段：**`area_id`**。

# Citations

[1] 盘古 MCP `list_event_properties` project_id=69 event_id=586450443039670297（2026-06-18）
[2] TE MCP `list_events` projectId=101 query=t_login（2026-06-18）
