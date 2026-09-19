---
type: Data Table
title: dwd_temperedheroes_event_logical — 百炼事件明细逻辑表
description: 百炼英雄注册/登录/支付等事件的统一 DWD 逻辑层；物理表名待 raw 数仓文档校准。
resource: logical://temperedheroes/dwd/event_logical
layer: dwd
project_id: 69
tags: [temperedheroes, dwd, events, logical]
owner: 数据组
status: draft
timestamp: 2026-06-18T00:00:00Z
---

# Overview

百炼全部继承 `t_default` 表头的元事件，在逻辑 DWD 中以 **`event_name`** 区分。ingest 来源：盘古 MCP 表头 + 核心事件 Schema（**非**物理 Hive/BQ 表名）。

# Schema

## t_default 表头（MCP 2026-06-18）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | string | ✓ | 平台 |
| `fday` | int | ✓ | 日期 |
| `ftime` | datetime | ✓ | 事件时间（TE `#time`） |
| `device_id` | string | ✓ | 设备 id |
| `version` | string | ✓ | 游戏版本 |
| `brand` | string | ✓ | 设备品牌 |
| `os` | string | | 系统 |
| `os_info` | string | | 系统详细信息 |
| `ip` | string | | IP |
| `lang` | string | | 语言 |
| `timezone` | string | | 时区 |
| `country` | string | | 国家 |
| `package` | int | | 渠道包 PACKAGE_TYPE |
| `login_type` | int | | 账号类型 LOGIN_TYPE |
| `uid` | string | | 玩家 uid |
| `customer_id` | int | | **用户 id（百炼去重口径）** |
| `area_id` | int | | **区服 id（AB 分流）** |
| `server_group_id` | int | | 跨服 id |

## 逻辑层扩展字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_name` | string | 元事件名（`t_register` / `t_login` / `t_pay_flow` …） |
| `stat_date` | date | 业务日（UTC+8，由 `ftime` 派生） |
| `generalcost` | bigint | 支付通用金额（`t_pay_flow`） |
| `gift_pack_id` | int | 礼包 id（`t_pay_flow`） |

事件专有字段见各 [Event 页](/behavioral/events/index.md)。

# Upstream Events

* [t_register](/behavioral/events/t_register.md)
* [t_login](/behavioral/events/t_login.md)
* [t_pay_flow](/behavioral/events/t_pay_flow.md)

# Downstream

* [dim_temperedheroes_user_logical](/behavioral/tables/dim_temperedheroes_user_logical.md)
* [dws_temperedheroes_user_daily_logical](/behavioral/tables/dws_temperedheroes_user_daily_logical.md)
* [ads_temperedheroes_firstcharge_ab_daily_logical](/behavioral/tables/ads_temperedheroes_firstcharge_ab_daily_logical.md)

# Pipeline

* [pip_temperedheroes_te_event_to_dwd](/behavioral/pipelines/pip_temperedheroes_te_event_to_dwd.md)

# Citations

[1] 盘古 MCP `list_event_properties` event_id=586450443039670272（t_default）
[2] [百炼生产指标实现](/projects/temperedheroes/metric-implementation.md)
