---
type: Query Template
title: q_fingertipff_arpu_daily — FF 日 ARPU（TE）
description: 指尖战纪 FF 日 ARPU 即席查数模板；金额字段 cost。
project_id: 82
te_project_id: 249
tags: [fingertipff, arpu, te-template]
owner: 数据组
status: active
metrics:
  - /semantic/metrics/arpu.md
timestamp: 2026-07-10T15:30:00Z
---

# 口径

**`sum(t_pay_flow.cost)`** / 同期 **`t_login` user_count**。

向业务报「元」时，可改用虚拟属性 **`#vp@cost_yuan`**（须与财务口径一致）。

# TE 执行

| 项 | 值 |
|----|-----|
| projectId | **249** |
| 流水事件 | `t_pay_flow` |
| 金额属性 | **`cost`**（非百炼 `generalcost`） |
| 分母 | `t_login` · `user_count` · `customer_id` |

## 与百炼差异（P0）

| 项目 | ARPU 分子 |
|------|-----------|
| 百炼 | `generalcost` |
| FF | `cost` 或 `#vp@cost_yuan` |

# 过滤器

[filter-registry](/projects/fingertipff/filter-registry.md)

# Citations

[1] [arpu](/semantic/metrics/arpu.md) · [t_pay_flow_fingertipff](/behavioral/events/t_pay_flow_fingertipff.md)
