---
type: Segment
title: AB 首充对照组（微小渠道 · 区服分流）
description: 百炼英雄首充档位 AB — 对照组用户分群（platform=temperedheroes_cn + 对照区服）。
tags: [ab-test, segment, temperedheroes, first-charge]
project_id: 69
owner: 数据组
status: draft
server_ids: [9994, 9996, 9998, 10000, 10002, 10004, 10006, 10008, 10010]
platform_filter: temperedheroes_cn
timestamp: 2026-06-17T00:00:00Z
---

# Definition

满足以下条件的用户归入 **对照组**：

1. 用户属性 `platform = temperedheroes_cn`（TE propId **575530**）
2. 用户所在区服 **`area_id`** ∈ `{9994, 9996, 9998, 10000, 10002, 10004, 10006, 10008, 10010}`

> ⚠️ AB 有效数据窗内 platform 单过滤返回 0；当前以 **area_id** 为准 → [Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)

# TE 标签建议

| 项 | 值 |
|----|-----|
| `tagName` | `ab_firstcharge_control` |
| `displayName` | 首充AB-对照组 |
| `type` | `condition` |

## 条件逻辑（示意）

```
platform == 'temperedheroes_cn'
AND area_id IN (9994, 9996, 9998, 10000, 10002, 10004, 10006, 10008, 10010)
```

# Citations

[1] 用户陈述（2026-06-17）
