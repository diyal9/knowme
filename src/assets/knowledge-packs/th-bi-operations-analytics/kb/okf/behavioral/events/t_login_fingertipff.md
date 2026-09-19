---
type: Tracking Event
title: t_login — 登录 / DAU（指尖战纪 FF）
description: 指尖战纪 FF 用户登录事件（TE projectId=249）。
event_name: t_login
project_id: 82
te_project_id: 249
te_event_id: 64147
tags: [core, engagement, fingertipff]
owner: 数据组
status: active
used_by_metrics:
  - /semantic/metrics/dau.md
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
  - /semantic/metrics/pay_rate.md
  - /semantic/metrics/arpu.md
timestamp: 2026-07-10T15:30:00Z
---

# 与百炼差异

| 项 | 百炼 | FF |
|----|------|-----|
| 事件名 | `t_login` | 同名 |
| TE eventId | 39613 | **64147** |
| 区服 | `area_id` | **无**；**`server_id`** 已确认在本事件 |
| DAU 去重 | `customer_id` | 同左 |

对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

# Schema（TE MCP 核验 · 核心字段）

| Property | Type | Description |
|----------|------|-------------|
| `customer_id` | string | **用户 id（DAU / 留存回访去重）** |
| `server_id` | number | 服务器 id |
| `platform` | string | 平台(注册时) |
| `os` | string | 操作系统 |
| `package` | number | 渠道包 |
| `event_type` | number | 事件类型 |
| `curr_lvl` | number | 当前玩家等级 |
| `curr_score` | number | 当前战力评分 |
| `adjustid` | string | adjust id |
| `timezone` | string | 时区 |

> **无 `area_id`**。区服类过滤优先 **`server_id`**。

# 生产用法

| 场景 | 规则 |
|------|------|
| DAU | 自然日 `t_login` 去重 `customer_id` |
| 留存回访 | `build_retention_analysis_qp` return=`t_login` |
| 时区 | TE 项目 offset=0 → 见 [readiness](/projects/fingertipff/analytics-readiness.md) |

# 相关

- [metric-implementation](/projects/fingertipff/metric-implementation.md)
- [百炼 t_login](/behavioral/events/t_login.md)

# Citations

[1] TE MCP `list_properties` projectId=249 eventName=t_login（2026-07-10）
