---
type: Query Template
title: q_fingertipff_retention_d1d7 — FF D1/D7 留存（TE）
description: 指尖战纪 FF 留存即席查数；t_register cohort → t_login 回访。
project_id: 82
te_project_id: 249
tags: [fingertipff, retention, d1, d7, te-template]
owner: 数据组
status: active
metrics:
  - /semantic/metrics/d1_retention.md
  - /semantic/metrics/d7_retention.md
timestamp: 2026-07-10T15:30:00Z
---

# Definition

FF 生产留存：cohort = **`t_register`** 当日注册用户，回访 = **`t_login`**。

# TE 执行

| 项 | 值 |
|----|-----|
| projectId | **249** |
| Builder | `build_retention_analysis_qp` |
| initial event | `t_register` |
| return event | `t_login` |
| unitNum | **1**（D1）/ **7**（D7） |
| 用户标识 | `customer_id` |

## 过滤器

[filter-registry](/projects/fingertipff/filter-registry.md)；区服用 **`server_id`**。

## 时区

同 [DAU 模板](/behavioral/queries/q_fingertipff_dau_daily.md) — FF offset=0 须确认。

# 已有 TE 报表（可选）

| reportId | 名称 |
|----------|------|
| 82904 | 注册留存【全渠道】 |
| 87158 | 账号维度-注册留存 |
| 87161 | 角色维度-注册留存 |

见 [FF 核心报表目录](/synthesis/fingertipff-core-reports-catalog.md)。

# 与百炼差异

百炼同链路但过滤器用 **`area_id`**；勿跨项目复制 QP 或报表 URL。

# Citations

[1] [metric-implementation](/projects/fingertipff/metric-implementation.md)
[2] [t_register_fingertipff](/behavioral/events/t_register_fingertipff.md) · [t_login_fingertipff](/behavioral/events/t_login_fingertipff.md)
