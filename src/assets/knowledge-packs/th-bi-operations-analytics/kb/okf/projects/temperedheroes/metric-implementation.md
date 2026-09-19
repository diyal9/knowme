---
type: Reference
title: 百炼英雄 — 生产指标实现（Metric Implementation）
description: 百炼英雄（69/101）各核心 KPI 的 TE 可执行口径；查数唯一依据。
tags: [temperedheroes, metrics, implementation, production]
project_id: 69
te_project_id: 101
status: active
owner: 数据组
timestamp: 2026-06-18T00:00:00Z
---

# Overview

本页为百炼英雄 **生产查数口径**。全局 [Metric 模板](/semantic/metrics/) 仅作抽象定义；**TE 跑数以本页为准**。

| 项 | 值 |
|----|-----|
| 盘古 project_id | **69** |
| TE projectId | **101** |
| 用户 ID | 事件 **`customer_id`**（去重） |
| 区服分流 | **`area_id`**（AB 实验；≠ `server_id`） |
| 微小渠道 | 用户属性 **`platform`**（TE propId **575530**，注册时） |

# 核心事件（TE 事件名 = 盘古 event_name）

| 业务 | 事件 | TE eventId | Wiki |
|------|------|------------|------|
| 注册 / 新进 cohort | `t_register` | **39612** | [t_register](/behavioral/events/t_register.md) |
| 登录 / DAU / 留存回访 | `t_login` | **39613** | [t_login](/behavioral/events/t_login.md) |
| 付费 / 流水 | `t_pay_flow` | — | [t_pay_flow](/behavioral/events/t_pay_flow.md) |

# 指标口径表

## DAU

| 项 | 值 |
|----|-----|
| 定义 | 自然日内 `t_login` 去重 **`customer_id`** |
| TE | `build_event_analysis_qp` · event=`t_login` · aggregation=`user_count` |
| 时区 | 业务日 UTC+8（与 TE 项目配置一致） |

## D1 / D7 留存（百炼生产）

| 项 | 值 |
|----|-----|
| 初始事件 | **`t_register`**（注册日 = cohort 日 T） |
| 回访事件 | **`t_login`** |
| TE | `build_retention_analysis_qp` · unitNum **1** / **7** |
| 说明 | 百炼 cohort 以 **注册成功** 为准（非行业「首日新增」抽象词） |

> 全局 [d1-cohort Conflict](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) 仍 open；**百炼 TE 留存以本表为准**。

## 付费率（护栏 · R8）

| 项 | 值 |
|----|-----|
| 定义 | 周期内 `t_pay_flow` 付费用户数 / 同期 `t_login` 活跃用户数 |
| TE | event 公式：`pay_users / login_users` |
| 过滤 | AB 场景叠加 **area_id** 列表 + 数据窗 |

## ARPU（护栏 · R8）

| 项 | 值 |
|----|-----|
| 定义 | **`sum(t_pay_flow.generalcost)`** / 同期 **`t_login` user_count** |
| 金额字段 | **`generalcost`**（非 `cost` 本地币） |
| 单位 | **TE 原始单位**（见 [readiness — generalcost](/projects/temperedheroes/analytics-readiness.md)） |

## 新用户首充转化率（AB 主 KPI · R2）

| 项 | 值 |
|----|-----|
| Cohort | 数据窗内 **`t_register`** 且 **area_id** ∈ 实验/对照列表 |
| 转化 | 同 cohort 用户发生 **`t_pay_flow`** 且 **`gift_pack_id` ∈ {400104,400105,400106}** |
| TE | `build_funnel_analysis_qp` 或 event 双指标 |
| 礼包枚举 | [first-charge-enums](/references/pango-dimensions/temperedheroes-first-charge-enums.md) |

## 首充流水 / 首充人均（R3/R5）

| 项 | 值 |
|----|-----|
| 流水 | `sum(generalcost)` where `gift_pack_id` ∈ 首充三档 |
| 首充人均（报告口径） | `sum(generalcost) / count(t_register cohort)` — **分母为新进，非付费人数** |
| 分档购买率 | 各档 `gift_pack_id` 的 `user_count` / 新进用户数 |

# AB 实验过滤器（首充档位 AB）

**当前生产过滤器（2026-06-17 第 1 期验证）**

| 组别 | area_id IN |
|------|------------|
| 实验组 | 9993,9995,9997,9999,10001,10003,10005,10007,10009 |
| 对照组 | 9994,9996,9998,10000,10002,10004,10006,10008,10010 |

- **不要**在 5/27~5/31 窗口单独加 `platform=temperedheroes_cn`（返回 0）→ 见 [Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)
- TE 标签：`ab_firstcharge_test` **15005** · `ab_firstcharge_control` **15006**

# 无法自动统计（勿报数）

| 指标 | 原因 |
|------|------|
| 档位解锁漏斗 R4 | 无「档位解锁」专用元事件 |
| 提前解锁占比 R6 | 无 `unlock_reason` 类字段 |
| platform 单过滤 AB | 用户属性在该窗无效 |

# 链到全局 Metric

| 本页口径 | 全局 Concept |
|----------|-------------|
| DAU | [dau](/semantic/metrics/dau.md) |
| D1/D7 | [d1](/semantic/metrics/d1_retention.md)、[d7](/semantic/metrics/d7_retention.md) |
| 付费率 / ARPU | [pay_rate](/semantic/metrics/pay_rate.md)、[arpu](/semantic/metrics/arpu.md) |

# Citations

[1] 盘古 MCP list_event_properties + get_dimension_info（2026-06-18）
[2] TE MCP list_events / list_properties projectId=101（2026-06-18）
[3] [首充 AB 第 1 期报告](/synthesis/temperedheroes-first-charge-ab-report-phase1.md)
