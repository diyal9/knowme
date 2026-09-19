---
type: Tracking Event
title: t_register — 注册（指尖战纪 FF）
description: 指尖战纪 FF 用户注册事件（TE projectId=249）。
event_name: t_register
project_id: 82
te_project_id: 249
te_event_id: 64146
tags: [core, acquisition, fingertipff]
owner: 数据组
status: active
used_by_metrics:
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
timestamp: 2026-07-10T15:30:00Z
---

# 与百炼差异

| 项 | 百炼 | FF |
|----|------|-----|
| 事件名 | `t_register` | 同名 |
| TE eventId | 39612 | **64146** |
| 区服 | `area_id` | **无**；可用 **`server_id`** |
| cohort 口径 | 注册成功日 | 同左 |

对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

# Schema（TE MCP 核验 · 核心字段）

继承 TE 公共表头 + 下列常用字段（`list_properties` eventName=`t_register` projectId=**249**）：

| Property | Type | Description |
|----------|------|-------------|
| `customer_id` | string | **用户 id（去重口径）** |
| `server_id` | number | 服务器 id（区服过滤优先字段） |
| `platform` | string | 平台(注册时)（事件属性 propId 575229） |
| `os` | string | 操作系统 |
| `package` | number | 渠道包 |
| `adjustid` | string | adjust id |
| `user_source` | string | 用户归因广告商（国内） |
| `ad_name` | string | 广告名 |
| `timezone` | string | 时区（事件上报） |

> **无 `area_id`**。勿从百炼复制区服过滤器。

# 生产用法

| 场景 | 规则 |
|------|------|
| D1/D7 cohort | 初始事件 **`t_register`** |
| TE | `build_retention_analysis_qp` initial=`t_register` |
| 过滤 | [filter-registry](/projects/fingertipff/filter-registry.md) |

# 相关

- [metric-implementation](/projects/fingertipff/metric-implementation.md)
- [百炼 t_register](/behavioral/events/t_register.md)（字段名勿混用）

# Citations

[1] TE MCP `list_properties` projectId=249 eventName=t_register（2026-07-10）
