---
type: Reference
title: 指尖战纪 FF — 生产指标实现（Metric Implementation）
description: 指尖战纪 FF（TE 249）各核心 KPI 的 TE 可执行口径；查数唯一依据。
tags: [fingertipff, metrics, implementation, production]
project_id: 82
te_project_id: 249
status: active
owner: 数据组
timestamp: 2026-07-10T14:55:00Z
---

# Overview

本页为指尖战纪 FF **生产查数口径**。全局 [Metric 模板](/semantic/metrics/) 仅作抽象定义；**TE 跑数以本页为准**。

| 项 | 值 |
|----|-----|
| 盘古 project_id | **82** |
| TE projectId | **249** |
| 用户 ID | 事件 **`customer_id`**（去重） |
| 区服相关 | **`area_opr`** / **`server_id`**（**无 `area_id`**） |
| 付费金额 | **`cost`**（**无 `generalcost`**） |
| 时区 | TE `defaultTimeZoneOffset=0`，`timeZoneEnabled=false` → 查数/导出前须确认业务日（百炼默认 UTC+8） |
| 金额（元） | 虚拟属性 **`#vp@cost_yuan`**；默认 ARPU 仍用 **`cost`** |

# 核心事件（TE 生产名）

| 业务 | 事件 | TE eventId | 备注 |
|------|------|------------|------|
| 注册 / cohort | `t_register` | **64146** | cohort 初始事件 |
| 登录 / DAU / 留存回访 | `t_login` | **64147** | |
| 付费流水 | `t_pay_flow` | **64841** | 金额字段 **`cost`** |
| 付费步骤 | `t_pay_step` | **64834** | 漏斗用，非 R8 默认 |

# 指标口径表

## DAU

| 项 | 值 |
|----|-----|
| 定义 | 自然日内 `t_login` 去重 **`customer_id`** |
| TE | `build_event_analysis_qp` · event=`t_login` · aggregation=`user_count` |
| 时区 | **待确认**业务统计时区（TE 配置 offset=0） |

## D1 / D7 留存

| 项 | 值 |
|----|-----|
| 初始事件 | **`t_register`** |
| 回访事件 | **`t_login`** |
| TE | `build_retention_analysis_qp` · unitNum **1** / **7** |
| 说明 | cohort 以注册成功为准；与行业「首日新增」抽象词可能不同 → 见全局 [d1-cohort Conflict](/synthesis/conflicts/d1-cohort-industry-vs-wiki.md) |

## 付费率

| 项 | 值 |
|----|-----|
| 定义 | 周期内 `t_pay_flow` 付费用户数 / 同期 `t_login` 活跃用户数 |
| TE | event 公式或双 `user_count` |
| 过滤 | 按 [filter-registry](/projects/fingertipff/filter-registry.md) slot |

## ARPU

| 项 | 值 |
|----|-----|
| 定义 | **`sum(t_pay_flow.cost)`** / 同期 **`t_login` user_count** |
| 金额字段 | **`cost`**（非百炼 `generalcost`） |
| 元口径 | TE 虚拟属性 **`#vp@cost_yuan`**（描述「付费金额（元）」） |
| 单位 | 对外报「元」优先 `cost_yuan`；`cost` 原始单位仍建议财务确认（见 [readiness](/projects/fingertipff/analytics-readiness.md)） |

# 与百炼（TH）不可混用项

| 项 | 百炼（101） | FF（249） |
|----|------------|-----------|
| 区服字段 | `area_id` | **`server_id`**（核心事件）；`area_opr` 视事件而定 |
| 付费金额 | `generalcost` | `cost` / `#vp@cost_yuan` |
| 渠道 platform | `temperedheroes_cn` 等 | **须 TE 现查枚举** |
| 时区 | UTC+8 默认 | offset=0，须确认 |
| TE projectId | 101 | 249 |

Canonical 对照：[ff-vs-temperedheroes-field-diff](/synthesis/ff-vs-temperedheroes-field-diff.md)

# 链到全局 Metric

| 本页口径 | 全局 Concept |
|----------|-------------|
| DAU | [dau](/semantic/metrics/dau.md) |
| D1/D7 | [d1](/semantic/metrics/d1_retention.md)、[d7](/semantic/metrics/d7_retention.md) |
| 付费率 / ARPU | [pay_rate](/semantic/metrics/pay_rate.md)、[arpu](/semantic/metrics/arpu.md) |

# Citations

[1] TE MCP `list_events` / `list_properties` projectId=249（2026-07-10）
[2] [filter-registry](/projects/fingertipff/filter-registry.md)
