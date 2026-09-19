---
type: Segment
title: AB 首充实验组（微小渠道 · 区服分流）
description: 百炼英雄首充档位 AB — 实验组用户分群（platform=temperedheroes_cn + 实验区服）。
tags: [ab-test, segment, temperedheroes, first-charge]
project_id: 69
owner: 数据组
status: draft
server_ids: [9993, 9995, 9997, 9999, 10001, 10003, 10005, 10007, 10009]
platform_filter: temperedheroes_cn
timestamp: 2026-06-17T00:00:00Z
---

# Definition

满足以下条件的用户归入 **实验组**：

1. 用户属性 `platform = temperedheroes_cn`（TE 用户属性 **propId=575530**，desc「平台(注册时)」）
2. 用户所在区服 **`area_id`** ∈ `{9993, 9995, 9997, 9999, 10001, 10003, 10005, 10007, 10009}`

> ⚠️ AB 有效数据窗内 **platform 单过滤返回 0**；当前看板以 **area_id** 为准 → [Conflict](/synthesis/conflicts/temperedheroes-platform-filter-vs-area-id.md)

# TE 标签建议

| 项 | 值 |
|----|-----|
| `tagName` | `ab_firstcharge_test` |
| `displayName` | 首充AB-实验组 |
| `type` | `condition` |

## 条件逻辑（示意，字段名待核验）

```
platform == 'temperedheroes_cn'
AND area_id IN (9993, 9995, 9997, 9999, 10001, 10003, 10005, 10007, 10009)
```

在 TE 创建后，所有 AB 看板按此标签与 [对照组](/semantic/segments/ab-firstcharge-control.md) **分组对比**。

# Edge Cases

- **换服用户**：若实验期间允许换服，须约定以注册服还是当前服为准（默认注册服）。
- **区服 ID 类型**：数值 vs 字符串须与 TE 枚举一致。

# Citations

[1] 用户陈述（2026-06-17）
