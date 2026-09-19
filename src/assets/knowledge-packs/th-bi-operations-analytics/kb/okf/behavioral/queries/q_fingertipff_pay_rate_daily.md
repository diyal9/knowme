---
type: Query Template
title: q_fingertipff_pay_rate_daily — FF 日付费率（TE）
description: 指尖战纪 FF 日付费率即席查数模板。
project_id: 82
te_project_id: 249
tags: [fingertipff, pay_rate, te-template]
owner: 数据组
status: active
metrics:
  - /semantic/metrics/pay_rate.md
timestamp: 2026-07-10T15:30:00Z
---

# 口径

周期内 **`t_pay_flow`** 付费用户数 / 同期 **`t_login`** 活跃用户数。

# TE 执行

| 项 | 值 |
|----|-----|
| projectId | **249** |
| 方式 | event 公式双 `user_count` 或 `build_event_analysis_qp` |
| 付费事件 | `t_pay_flow` |
| 活跃事件 | `t_login` |
| 去重 | `customer_id` |

## 过滤器

[filter-registry](/projects/fingertipff/filter-registry.md)

# 注意

- 勿使用百炼 AB 的 `area_id` 列表
- 退款是否回滚付费 → [readiness P1#8](/projects/fingertipff/analytics-readiness.md)

# Citations

[1] [pay_rate](/semantic/metrics/pay_rate.md) · [metric-implementation](/projects/fingertipff/metric-implementation.md)
