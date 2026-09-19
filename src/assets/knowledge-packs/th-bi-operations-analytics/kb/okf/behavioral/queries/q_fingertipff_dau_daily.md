---
type: Query Template
title: q_fingertipff_dau_daily — FF 日 DAU（TE）
description: 指尖战纪 FF 日 DAU 即席查数模板；TE projectId=249。
project_id: 82
te_project_id: 249
tags: [fingertipff, dau, te-template]
owner: 数据组
status: active
metrics:
  - /semantic/metrics/dau.md
timestamp: 2026-07-10T15:30:00Z
---

# 口径

自然日内 **`t_login`** 去重 **`customer_id`**。生产定义见 [metric-implementation](/projects/fingertipff/metric-implementation.md)。

# TE 执行

| 项 | 值 |
|----|-----|
| projectId | **249** |
| Builder | `build_event_analysis_qp` |
| event | `t_login` |
| aggregation | `user_count` |
| 去重属性 | `customer_id` |

## 过滤器

按 [filter-registry](/projects/fingertipff/filter-registry.md) slot 叠加，例如：

- 分端：`os` eq `iOS` / `Android`
- 区服：**`server_id`**（勿用百炼 `area_id`）

## 时区

TE `defaultTimeZoneOffset=0` → 查数前确认业务日窗口（见 [readiness](/projects/fingertipff/analytics-readiness.md)）。

# 已有 TE 报表（可选）

| reportId | 名称 |
|----------|------|
| 87052 | 活跃数据 |
| 87050 | 角色活跃数据 |

见 [FF 核心报表目录](/synthesis/fingertipff-core-reports-catalog.md)。

# Citations

[1] [dau](/semantic/metrics/dau.md) · [t_login_fingertipff](/behavioral/events/t_login_fingertipff.md)
